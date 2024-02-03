import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getInventoryItemDef } from '@d2api/manifest-web';
import { BungieMembershipType } from 'bungie-api-ts/common';
import {
  DestinyCollectibleState,
  DestinyComponentType,
  getProfile,
  searchDestinyPlayerByBungieName,
} from 'bungie-api-ts/destiny2';
import { searchByGlobalNamePost } from 'bungie-api-ts/user';
import {
  UserInfoCard,
  UserMembershipData,
} from 'bungie-api-ts/user/interfaces';
import {
  BehaviorSubject,
  EMPTY,
  catchError,
  combineLatest,
  from,
  lastValueFrom,
  map,
  take,
  tap,
} from 'rxjs';
import { ManifestService } from '../manifest/manifest.service';
import { P2PCFService } from '../p2pcf.service';

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  combinedSets: {
    [key: string]: {
      exotics: {
        [slotHash: number]: Set<number>;
      };
      nonExotics: {
        [slotHash: number]: Set<number>;
      };
      pullableExotics: {
        [slotHash: number]: Set<number>;
      };
      pullableNonExotics: {
        [slotHash: number]: Set<number>;
      };
    };
  } = {
    union: {
      exotics: {},
      nonExotics: {},
      pullableExotics: {},
      pullableNonExotics: {},
    },
    intersection: {
      exotics: {},
      nonExotics: {},
      pullableExotics: {},
      pullableNonExotics: {},
    },
  };
  classWeaponSet = new Set([
    '1180270694',
    '2782325302',
    '1180270692',
    '2782325300',
    '1180270693',
    '2782325301',
    '569799273',
    '569799275',
    '569799274',
  ]);
  minPower = new BehaviorSubject(0);
  combinedSetsLoading = new BehaviorSubject(false);
  localPlayer$ = new BehaviorSubject<DestinyPlayer | null>(null);
  remotePlayers$ = new BehaviorSubject<DestinyPlayer[]>([]);
  manualPlayers$ = new BehaviorSubject<DestinyPlayer[]>([]);
  players$ = combineLatest([
    this.localPlayer$,
    this.remotePlayers$,
    this.manualPlayers$,
  ]).pipe(
    map(([localPlayer, remotePlayers, manualPlayers]) =>
      localPlayer
        ? [localPlayer, ...remotePlayers, ...manualPlayers]
        : [...remotePlayers, ...manualPlayers]
    )
  );

  constructor(
    private http: HttpClient,
    private manifest: ManifestService,
    private p2pcfService: P2PCFService
  ) {
    this.players$
      .pipe(
        tap(() => {
          this.combinedSetsLoading.next(true);
          this.updateCombinedSets();
        })
      )
      .subscribe();
  }

  addLocalPlayer(membership: UserMembershipData) {
    const player: DestinyPlayer = {
      name: '',
      playerType: 'local',
      status: 'loading',
      membershipId: '',
      membershipType: BungieMembershipType.None,
      suspectNonEquippedDisabled: false,
      suspectProgressionDisabled: false,
      exotics: {},
      nonExotics: {},
      // types: {},
      // archetypes: {},
      pullableExotics: {},
      pullableNonExotics: {},
    };

    if (
      membership.destinyMemberships.length > 1 &&
      !membership.primaryMembershipId
    ) {
      membership.destinyMemberships.forEach((mem) =>
        player.possibleMemberships?.push(mem)
      );
      player.status = 'chooseMembership';
    } else {
      const playerRes = membership.primaryMembershipId
        ? membership.destinyMemberships.filter(
            (mem) => mem.membershipId === membership.primaryMembershipId
          )[0]
        : membership.destinyMemberships[0];

      player.name = playerRes.bungieGlobalDisplayName;
      player.nameCode = playerRes.bungieGlobalDisplayNameCode;
      player.membershipId = playerRes.membershipId;
      player.membershipType = playerRes.membershipType;

      this.localPlayer$.next(player);

      this.manifest.state$.subscribe((state) => {
        if (state === 'ready') {
          this.fetchWeapons(player);
        }
      });
    }
  }

  addRemotePlayer(player: DestinyPlayer) {
    player.playerType = 'remote';
    this.remotePlayers$
      .pipe(
        take(1),
        map((remotePlayers) => {
          this.remotePlayers$.next([
            player,
            ...remotePlayers.filter(
              (p) => p.membershipId !== player.membershipId
            ),
          ]);
        })
      )
      .subscribe();
  }

  addManualPlayer(player: DestinyPlayer | string) {
    if (typeof player === 'object') {
      player.playerType = 'manual';
      this.manualPlayers$
        .pipe(
          take(1),
          map((manualPlayers) => {
            this.manualPlayers$.next([
              ...manualPlayers.filter(
                (p) => p.membershipId !== player.membershipId
              ),
              player,
            ]);
          })
        )
        .subscribe();
    }

    if (typeof player === 'string') {
      const p: DestinyPlayer = {
        name: player,
        playerType: 'manual',
        status: 'loading',
        membershipId: '',
        membershipType: BungieMembershipType.None,
        suspectNonEquippedDisabled: false,
        suspectProgressionDisabled: false,
        exotics: {},
        nonExotics: {},
        // types: {},
        // archetypes: {},
        pullableExotics: {},
        pullableNonExotics: {},
      };
      this.manualPlayers$
        .pipe(
          take(1),
          map((manualPlayers) => {
            this.manualPlayers$.next([
              ...manualPlayers.filter((m) => m.membershipId !== p.membershipId),
              p,
            ]);
          })
        )
        .subscribe();
      this.findDestinyMembership(p);
    }
  }

  findDestinyMembership(player: DestinyPlayer) {
    player.status = 'loading';
    player.possibleMemberships = [];
    if (player.name.indexOf('#') > -1) {
      from(
        searchDestinyPlayerByBungieName(
          (config) =>
            lastValueFrom(
              this.http.request(config.method, config.url, {
                params: config.params,
                body: config.body,
              })
            ),
          {
            membershipType: BungieMembershipType.All,
          },
          {
            displayName: player.name.split('#')[0],
            displayNameCode: Number(player.name.split('#')[1]),
          }
        )
      ).subscribe({
        next: (res) => {
          const memberships = res.Response.filter(
            (p) => p.applicableMembershipTypes.length > 0
          );

          this.handleMemberships(player, memberships);
        },
        error: (err) => {
          console.error(err);
          player.status = 'erred';
          this.manualPlayers$
            .pipe(
              take(1),
              map((manualPlayers) => {
                this.manualPlayers$.next([
                  ...manualPlayers.filter(
                    (p) => p.membershipId !== player.membershipId
                  ),
                  player,
                ]);
              })
            )
            .subscribe();
        },
      });
    } else {
      from(
        searchByGlobalNamePost(
          (config) =>
            lastValueFrom(
              this.http.request(config.method, config.url, {
                params: config.params,
                body: config.body,
              })
            ),
          {
            page: 0,
          },
          {
            displayNamePrefix: player.name,
          }
        )
      ).subscribe({
        next: (res) => {
          if (res.Response.searchResults.length < 1) {
            player.status = 'erred';
            this.manualPlayers$
              .pipe(
                take(1),
                map((manualPlayers) => {
                  this.manualPlayers$.next([
                    ...manualPlayers.filter(
                      (p) => p.membershipId !== player.membershipId
                    ),
                    player,
                  ]);
                })
              )
              .subscribe();
          } else if (res.Response.searchResults.length > 1) {
            const memberships = res.Response.searchResults.flatMap((result) =>
              result.destinyMemberships.filter(
                (mem) => mem.applicableMembershipTypes.length > 0
              )
            );
            this.handleMemberships(player, memberships);
          } else {
            const memberships =
              res.Response.searchResults[0].destinyMemberships.filter(
                (p) => p.applicableMembershipTypes.length > 0
              );

            this.handleMemberships(player, memberships);
          }
        },
        error: (err) => {
          player.status = 'erred';
        },
      });
    }
  }

  handleMemberships(player: DestinyPlayer, memberships: UserInfoCard[]) {
    if (memberships.length < 1) {
      player.status = 'erred';
    } else if (memberships.length > 1) {
      memberships.forEach((mem) => player.possibleMemberships?.push(mem));
      player.status = 'chooseMembership';
    } else {
      const playerRes = memberships[0];

      player.name = playerRes.bungieGlobalDisplayName;
      player.nameCode = playerRes.bungieGlobalDisplayNameCode;
      player.membershipId = playerRes.membershipId;
      player.membershipType = playerRes.membershipType;

      this.fetchWeapons(player);
    }
  }

  togglePlayer(player: DestinyPlayer) {
    player.disabled = !player.disabled;

    switch (player.playerType) {
      case 'local':
        this.localPlayer$.next(player);
        break;
      case 'remote':
        this.remotePlayers$
          .pipe(
            take(1),
            map((remotePlayers) => {
              this.remotePlayers$.next([
                ...remotePlayers.filter(
                  (p) => p.membershipId !== player.membershipId
                ),
                player,
              ]);
            })
          )
          .subscribe();
        this.p2pcfService.p2pcf?.broadcast(
          new TextEncoder().encode(
            JSON.stringify({
              type: 'toggleRemotePlayer',
              body: {
                membershipId: player.membershipId,
                disabled: player.disabled,
              },
            })
          )
        );
        break;
      case 'manual':
        this.manualPlayers$
          .pipe(
            take(1),
            map((manualPlayers) => {
              this.manualPlayers$.next([
                ...manualPlayers.filter(
                  (p) => p.membershipId !== player.membershipId
                ),
                player,
              ]);
            })
          )
          .subscribe();
        this.p2pcfService.p2pcf?.broadcast(
          new TextEncoder().encode(
            JSON.stringify({ type: 'manualPlayer', body: player })
          )
        );
        break;
    }
  }

  toggleRemotePlayer(membershipId: string, disabled: boolean) {
    this.localPlayer$
      .pipe(
        take(1),
        map((localPlayer) => {
          if (localPlayer && localPlayer.membershipId === membershipId) {
            localPlayer.disabled = disabled;
            this.localPlayer$.next(localPlayer);
          }
        })
      )
      .subscribe();
  }

  refreshRemotePlayer(membershipId: string) {
    this.localPlayer$
      .pipe(
        take(1),
        map((localPlayer) => {
          console.log(membershipId, localPlayer?.membershipId);
          if (localPlayer && localPlayer.membershipId === membershipId) {
            this.fetchWeapons(localPlayer);
          }
        })
      )
      .subscribe();
  }

  removeRemotePlayer(membershipId: string) {
    this.remotePlayers$
      .pipe(
        take(1),
        map((remotePlayers) => {
          this.remotePlayers$.next(
            remotePlayers.filter((p) => p.membershipId !== membershipId)
          );
        })
      )
      .subscribe();
  }

  removeManualPlayer(membershipId: string) {
    this.manualPlayers$
      .pipe(
        take(1),
        map((manualPlayers) => {
          this.manualPlayers$.next(
            manualPlayers.filter((p) => p.membershipId !== membershipId)
          );
        })
      )
      .subscribe();
  }

  refreshPlayer(player: DestinyPlayer) {
    if (player.playerType === 'local' || player.playerType === 'manual') {
      this.fetchWeapons(player);
    } else {
      this.p2pcfService.p2pcf?.broadcast(
        new TextEncoder().encode(
          JSON.stringify({
            type: 'refreshRemotePlayer',
            body: {
              membershipId: player.membershipId,
            },
          })
        )
      );
    }
  }

  fetchWeapons(player: DestinyPlayer) {
    player.status = 'loading';
    player.suspectNonEquippedDisabled = false;
    player.suspectProgressionDisabled = false;
    player.exotics = {};
    player.nonExotics = {};
    // player.types =  {};
    // player.archetypes =  {};
    player.pullableExotics = {};
    player.pullableNonExotics = {};

    if (player.playerType === 'local') {
      this.localPlayer$.next(player);
    } else {
      this.p2pcfService.p2pcf?.broadcast(
        new TextEncoder().encode(
          JSON.stringify({ type: 'manualPlayer', body: player })
        )
      );
      this.manualPlayers$
        .pipe(
          take(1),
          map((manualPlayers) => {
            this.manualPlayers$.next([
              ...manualPlayers.filter(
                (p) => p.membershipId !== player.membershipId
              ),
              player,
            ]);
          })
        )
        .subscribe();
    }

    from(
      getProfile(
        (config) =>
          lastValueFrom(
            this.http.request(config.method, config.url, {
              params: config.params,
              body: config.body,
            })
          ),
        {
          destinyMembershipId: player.membershipId,
          membershipType: player.membershipType,
          components: [
            DestinyComponentType.Collectibles,
            DestinyComponentType.CharacterEquipment,
            DestinyComponentType.CharacterInventories,
            DestinyComponentType.Characters,
            DestinyComponentType.ItemInstances,
            DestinyComponentType.ProfileInventories,
          ],
        }
      )
    )
      .pipe(
        map((res) => {
          const charactersData = res.Response.characters.data;
          if (charactersData) {
            const keys = Object.keys(charactersData);

            keys.sort((a, b) => {
              return (
                new Date(charactersData[b].dateLastPlayed).valueOf() -
                new Date(charactersData[a].dateLastPlayed).valueOf()
              );
            });

            const character = charactersData[keys[0]];

            player.emblemPath = character.emblemPath;
          }

          const characterEquipmentData = res.Response.characterEquipment.data;
          if (characterEquipmentData) {
            const keys = Object.keys(characterEquipmentData);
            keys.forEach((key) => {
              characterEquipmentData[key].items.forEach((item) => {
                this.sortItem(player, item.itemHash);
              });
            });
          }

          const characterInventoriesData =
            res.Response.characterInventories.data;
          if (characterInventoriesData) {
            const keys = Object.keys(characterInventoriesData);
            keys.forEach((key) => {
              characterInventoriesData[key].items.forEach((item) => {
                this.sortItem(player, item.itemHash);
              });
            });
          }

          const profileInventoryData = res.Response.profileInventory.data;
          if (profileInventoryData) {
            profileInventoryData.items.forEach((item) => {
              this.sortItem(player, item.itemHash);
            });
          } else {
            player.suspectNonEquippedDisabled = true;
          }

          const characterCollectiblesData =
            res.Response.characterCollectibles.data;
          if (characterCollectiblesData) {
            const keys = Object.keys(characterCollectiblesData);
            keys.forEach((key) => {
              const collectibleHashes = Object.keys(
                characterCollectiblesData[key].collectibles
              );
              collectibleHashes.forEach((collectibleHash) => {
                const collectible =
                  characterCollectiblesData[key].collectibles[
                    Number(collectibleHash)
                  ];

                if (collectible.state === DestinyCollectibleState.None) {
                  this.sortCollectible(player, Number(collectibleHash));
                }
              });
            });
          }

          const profileCollectiblesData = res.Response.profileCollectibles.data;
          if (profileCollectiblesData) {
            const collectibleHashes = Object.keys(
              profileCollectiblesData.collectibles
            );
            collectibleHashes.forEach((collectibleHash) => {
              const collectible =
                profileCollectiblesData.collectibles[Number(collectibleHash)];
              if (
                collectible.state === DestinyCollectibleState.None ||
                collectible.state ===
                  DestinyCollectibleState.CannotAffordMaterialRequirements ||
                collectible.state ===
                  DestinyCollectibleState.InventorySpaceUnavailable
              ) {
                this.sortCollectible(player, Number(collectibleHash));
              }
            });
          } else {
            player.suspectProgressionDisabled = true;
          }

          player.status = 'ready';
          if (player.playerType === 'local') {
            this.localPlayer$.next(player);
          } else {
            this.p2pcfService.p2pcf?.broadcast(
              new TextEncoder().encode(
                JSON.stringify({ type: 'manualPlayer', body: player })
              )
            );
            this.manualPlayers$
              .pipe(
                take(1),
                map((manualPlayers) => {
                  this.manualPlayers$.next([
                    ...manualPlayers.filter(
                      (p) => p.membershipId !== player.membershipId
                    ),
                    player,
                  ]);
                })
              )
              .subscribe();
          }
        }),
        catchError((err, caught) => {
          console.error(err);
          player.status = 'erred';
          this.localPlayer$.next(player);

          return EMPTY;
        })
      )
      .subscribe();
  }

  sortItem(player: DestinyPlayer, itemHash: number) {
    const item = getInventoryItemDef(itemHash);
    const splitName = item?.displayProperties.name
      .split(' (')[0]
      .split('_v1')[0];

    const hashes =
      splitName && this.manifest.nonExoticNameLookup[splitName]
        ? this.manifest.nonExoticNameLookup[splitName]
        : new Set([itemHash]);

    const firstHash = [...hashes][0];

    this.manifest.slotHashSet.forEach((slotHash) => {
      if (this.manifest.exoticLookup[slotHash].has(firstHash)) {
        player.exotics[slotHash]
          ? player.exotics[slotHash].push(firstHash)
          : (player.exotics[slotHash] = [firstHash]);
      }
      if (this.manifest.nonExoticLookup[slotHash].has(firstHash)) {
        player.nonExotics[slotHash]
          ? player.nonExotics[slotHash].push(firstHash)
          : (player.nonExotics[slotHash] = [firstHash]);
      }
    });
  }

  sortCollectible(player: DestinyPlayer, collectibleHash: number) {
    this.manifest.slotHashSet.forEach((slotHash) => {
      if (this.manifest.pullableExotics[slotHash].has(collectibleHash)) {
        player.pullableExotics[slotHash]
          ? player.pullableExotics[slotHash].push(collectibleHash)
          : (player.pullableExotics[slotHash] = [collectibleHash]);
      }
      if (this.manifest.pullableNonExotics[slotHash].has(collectibleHash)) {
        player.pullableNonExotics[slotHash]
          ? player.pullableNonExotics[slotHash].push(collectibleHash)
          : (player.pullableNonExotics[slotHash] = [collectibleHash]);
      }
    });
  }

  updateCombinedSets() {
    this.players$
      .pipe(
        take(1),
        map((players) => {
          const loading =
            players.filter((p) => p.status === 'loading').length > 0;
          if (loading) {
            return;
          }

          this.manifest.slotHashSet.forEach((slotHash) => {
            this.combinedSets.union.exotics[slotHash] = new Set();
            this.combinedSets.union.nonExotics[slotHash] = new Set();
            this.combinedSets.union.pullableExotics[slotHash] = new Set();
            this.combinedSets.union.pullableNonExotics[slotHash] = new Set();
          });

          players
            .filter((p) => p.status === 'ready' && !p.disabled)
            .forEach((player) => {
              this.manifest.slotHashSet.forEach((slotHash) => {
                this.combinedSets.union.exotics[slotHash] = new Set([
                  ...this.combinedSets.union.exotics[slotHash],
                  ...(player.exotics[slotHash] || []),
                ]);
                this.combinedSets.union.nonExotics[slotHash] = new Set([
                  ...this.combinedSets.union.nonExotics[slotHash],
                  ...(player.nonExotics[slotHash] || []),
                ]);
                this.combinedSets.union.pullableExotics[slotHash] = new Set([
                  ...this.combinedSets.union.pullableExotics[slotHash],
                  ...(player.pullableExotics[slotHash] || []),
                ]);
                this.combinedSets.union.pullableNonExotics[slotHash] = new Set([
                  ...this.combinedSets.union.pullableNonExotics[slotHash],
                  ...(player.pullableNonExotics[slotHash] || []),
                ]);
              });
            });

          this.manifest.slotHashSet.forEach((slotHash) => {
            this.combinedSets.intersection.exotics[slotHash] = new Set([
              ...this.combinedSets.union.exotics[slotHash],
            ]);
            this.combinedSets.intersection.nonExotics[slotHash] = new Set([
              ...this.combinedSets.union.nonExotics[slotHash],
            ]);
            this.combinedSets.intersection.pullableExotics[slotHash] = new Set([
              ...this.combinedSets.union.pullableExotics[slotHash],
            ]);
            this.combinedSets.intersection.pullableNonExotics[slotHash] =
              new Set([
                ...this.combinedSets.union.pullableNonExotics[slotHash],
              ]);
          });

          players
            .filter((p) => p.status === 'ready' && !p.disabled)
            .forEach((player) => {
              this.manifest.slotHashSet.forEach((slotHash) => {
                this.combinedSets.intersection.exotics[slotHash] = new Set(
                  player.exotics[slotHash]
                    ? [
                        ...this.combinedSets.intersection.exotics[slotHash],
                      ].filter(
                        (itemHash: number) =>
                          player.exotics[slotHash].indexOf(itemHash) > -1
                      )
                    : []
                );
                this.combinedSets.intersection.nonExotics[slotHash] = new Set(
                  player.nonExotics[slotHash]
                    ? [
                        ...this.combinedSets.intersection.nonExotics[slotHash],
                      ].filter(
                        (itemHash: number) =>
                          player.nonExotics[slotHash].indexOf(itemHash) > 1
                      )
                    : []
                );
                this.combinedSets.intersection.pullableExotics[slotHash] =
                  new Set(
                    player.pullableExotics[slotHash]
                      ? [
                          ...this.combinedSets.intersection.pullableExotics[
                            slotHash
                          ],
                        ].filter(
                          (collectibleHash: number) =>
                            player.pullableExotics[slotHash].indexOf(
                              collectibleHash
                            ) > -1
                        )
                      : []
                  );
                this.combinedSets.intersection.pullableNonExotics[slotHash] =
                  new Set(
                    player.pullableNonExotics[slotHash]
                      ? [
                          ...this.combinedSets.intersection.pullableNonExotics[
                            slotHash
                          ],
                        ].filter(
                          (collectibleHash: number) =>
                            player.pullableNonExotics[slotHash].indexOf(
                              collectibleHash
                            ) > -1
                        )
                      : []
                  );
              });
            });

          this.combinedSetsLoading.next(false);
        })
      )
      .subscribe();
  }
}

export type DestinyPlayer = {
  name: string;
  playerType: 'local' | 'remote' | 'manual';
  nameCode?: number;
  possibleMemberships?: UserInfoCard[];
  membershipId: string;
  membershipType: BungieMembershipType;
  lastImport?: Date;
  status: 'loading' | 'chooseMembership' | 'ready' | 'erred';
  emblemPath?: string;
  emblemBackgroundPath?: string;
  suspectNonEquippedDisabled: boolean;
  suspectProgressionDisabled: boolean;
  disabled?: boolean;
  exotics: {
    [slotHash: number]: Array<number>;
  };
  nonExotics: {
    [slotHash: number]: Array<number>;
  };
  pullableExotics: {
    [slotHash: number]: Array<number>;
  };
  pullableNonExotics: {
    [slotHash: number]: Array<number>;
  };
};
