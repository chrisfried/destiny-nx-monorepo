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
import { UserInfoCard } from 'bungie-api-ts/user/interfaces';
import {
  BehaviorSubject,
  catchError,
  EMPTY,
  from,
  lastValueFrom,
  map,
} from 'rxjs';
import { ManifestService } from '../manifest/manifest.service';

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  players: DestinyPlayer[] = [];
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

  constructor(private http: HttpClient, private manifest: ManifestService) {}

  addPlayer(name: string) {
    this.combinedSetsLoading.next(true);
    const player: DestinyPlayer = {
      name: name,
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
    this.players.push(player);
    this.findDestinyMembership(player);
  }

  removePlayer(index: number) {
    this.players.splice(index, 1);
    this.updateCombinedSets();
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
          this.updateCombinedSets();
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
            this.updateCombinedSets();
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
          console.error(err);
          player.status = 'erred';
          this.updateCombinedSets();
        },
      });
    }
  }

  handleMemberships(player: DestinyPlayer, memberships: UserInfoCard[]) {
    if (memberships.length < 1) {
      player.status = 'erred';
      this.updateCombinedSets();
    } else if (memberships.length > 1) {
      memberships.forEach((mem) => player.possibleMemberships?.push(mem));
      player.status = 'chooseMembership';
      this.updateCombinedSets();
    } else {
      const playerRes = memberships[0];

      player.name = playerRes.bungieGlobalDisplayName;
      player.nameCode = playerRes.bungieGlobalDisplayNameCode;
      player.membershipId = playerRes.membershipId;
      player.membershipType = playerRes.membershipType;

      this.fetchWeapons(player);
    }
  }

  fetchWeapons(player: DestinyPlayer) {
    this.combinedSetsLoading.next(true);
    player.status = 'loading';
    player.suspectNonEquippedDisabled = false;
    player.suspectProgressionDisabled = false;
    player.exotics = {};
    player.nonExotics = {};
    // player.types =  {};
    // player.archetypes =  {};
    player.pullableExotics = {};
    player.pullableNonExotics = {};

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
            DestinyComponentType.CharacterEquipment,
            DestinyComponentType.CharacterInventories,
            DestinyComponentType.ProfileInventories,
            DestinyComponentType.Collectibles,
            DestinyComponentType.Characters,
            DestinyComponentType.ItemInstances,
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
          this.updateCombinedSets();
        }),
        catchError((err, caught) => {
          console.error(err);
          player.status = 'erred';
          this.updateCombinedSets();

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
          ? player.exotics[slotHash].add(firstHash)
          : (player.exotics[slotHash] = new Set([firstHash]));
      }
      if (this.manifest.nonExoticLookup[slotHash].has(firstHash)) {
        player.nonExotics[slotHash]
          ? player.nonExotics[slotHash].add(firstHash)
          : (player.nonExotics[slotHash] = new Set([firstHash]));
      }
    });
  }

  sortCollectible(player: DestinyPlayer, collectibleHash: number) {
    this.manifest.slotHashSet.forEach((slotHash) => {
      if (this.manifest.pullableExotics[slotHash].has(collectibleHash)) {
        player.pullableExotics[slotHash]
          ? player.pullableExotics[slotHash].add(collectibleHash)
          : (player.pullableExotics[slotHash] = new Set([collectibleHash]));
      }
      if (this.manifest.pullableNonExotics[slotHash].has(collectibleHash)) {
        player.pullableNonExotics[slotHash]
          ? player.pullableNonExotics[slotHash].add(collectibleHash)
          : (player.pullableNonExotics[slotHash] = new Set([collectibleHash]));
      }
    });
  }

  updateCombinedSets() {
    const loading =
      this.players.filter((p) => p.status === 'loading').length > 0;
    if (loading) {
      return;
    }

    this.manifest.slotHashSet.forEach((slotHash) => {
      this.combinedSets.union.exotics[slotHash] = new Set();
      this.combinedSets.union.nonExotics[slotHash] = new Set();
      this.combinedSets.union.pullableExotics[slotHash] = new Set();
      this.combinedSets.union.pullableNonExotics[slotHash] = new Set();
    });

    this.players
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
      this.combinedSets.intersection.pullableNonExotics[slotHash] = new Set([
        ...this.combinedSets.union.pullableNonExotics[slotHash],
      ]);
    });

    this.players
      .filter((p) => p.status === 'ready')
      .forEach((player) => {
        this.manifest.slotHashSet.forEach((slotHash) => {
          this.combinedSets.intersection.exotics[slotHash] = new Set(
            player.exotics[slotHash]
              ? [...this.combinedSets.intersection.exotics[slotHash]].filter(
                  (itemHash: number) => player.exotics[slotHash].has(itemHash)
                )
              : []
          );
          this.combinedSets.intersection.nonExotics[slotHash] = new Set(
            player.nonExotics[slotHash]
              ? [...this.combinedSets.intersection.nonExotics[slotHash]].filter(
                  (itemHash: number) =>
                    player.nonExotics[slotHash].has(itemHash)
                )
              : []
          );
          this.combinedSets.intersection.pullableExotics[slotHash] = new Set(
            player.pullableExotics[slotHash]
              ? [
                  ...this.combinedSets.intersection.pullableExotics[slotHash],
                ].filter((collectibleHash: number) =>
                  player.pullableExotics[slotHash].has(collectibleHash)
                )
              : []
          );
          this.combinedSets.intersection.pullableNonExotics[slotHash] = new Set(
            player.pullableNonExotics[slotHash]
              ? [
                  ...this.combinedSets.intersection.pullableNonExotics[
                    slotHash
                  ],
                ].filter((collectibleHash: number) =>
                  player.pullableNonExotics[slotHash].has(collectibleHash)
                )
              : []
          );
        });
      });

    this.combinedSetsLoading.next(false);
  }
}

export type DestinyPlayer = {
  name: string;
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
