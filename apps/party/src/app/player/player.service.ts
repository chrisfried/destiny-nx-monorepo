import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getInventoryItemDef } from '@d2api/manifest-web';
import { BungieMembershipType } from 'bungie-api-ts/common';
import {
  DestinyCollectibleState,
  DestinyComponentType,
  DestinyProfileResponse,
  getProfile,
} from 'bungie-api-ts/destiny2';
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
} from 'rxjs';
import { ManifestService } from '../manifest/manifest.service';

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
  localPlayerProfile$ = new BehaviorSubject<DestinyProfileResponse | null>(
    null
  );
  localPlayer$ = new BehaviorSubject<DestinyPlayer | null>(null);
  remotePlayers$ = new BehaviorSubject<DestinyPlayer[]>([]);
  players$ = combineLatest([this.localPlayer$, this.remotePlayers$]).pipe(
    map(([localPlayer, remotePlayers]) =>
      localPlayer ? [localPlayer, ...remotePlayers] : remotePlayers
    )
  );

  constructor(private http: HttpClient, private manifest: ManifestService) {
    combineLatest([this.localPlayer$, this.remotePlayers$])
      .pipe(
        map(([localPlayer, remotePlayers]) => {
          if (
            localPlayer?.status === 'loading' ||
            remotePlayers.filter((p) => p.status === 'loading').length > 0
          ) {
            this.combinedSetsLoading.next(true);
          } else {
            this.updateCombinedSets();
          }
        })
      )
      .subscribe();
  }

  addLocalPlayer(membership: UserMembershipData) {
    const player: DestinyPlayer = {
      name: '',
      localPlayer: true,
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
    player.localPlayer = false;
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

  removePlayer(membershipId: string) {
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

    this.localPlayer$.next(player);

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
          this.localPlayerProfile$.next(res.Response);
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
          this.localPlayer$.next(player);
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
            .filter((p) => p.status === 'ready')
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
            .filter((p) => p.status === 'ready')
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
  localPlayer?: boolean;
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
