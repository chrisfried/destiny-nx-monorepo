import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BungieMembershipType } from 'bungie-api-ts/content';
import {
  DestinyCollectibleState,
  DestinyComponentType,
  getProfile,
  searchDestinyPlayerByBungieName,
} from 'bungie-api-ts/destiny2';
import { BehaviorSubject, from, lastValueFrom, map, switchMap } from 'rxjs';
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
      types: {
        [slotHash: number]: {
          [typeHash: number]: Set<number>;
        };
      };
      archetypes: {
        [slotHash: number]: {
          [archetypeHash: number]: Set<number>;
        };
      };
    };
  } = {
    union: {
      exotics: {},
      nonExotics: {},
      pullableExotics: {},
      pullableNonExotics: {},
      types: {},
      archetypes: {},
    },
    intersection: {
      exotics: {},
      nonExotics: {},
      pullableExotics: {},
      pullableNonExotics: {},
      types: {},
      archetypes: {},
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

  constructor(private http: HttpClient, private manifest: ManifestService) {}

  addPlayer(name: string) {
    const player: DestinyPlayer = {
      name: name,
      status: 'loading',
      exotics: {},
      nonExotics: {},
      types: {},
      archetypes: {},
      pullableExotics: {},
      pullableNonExotics: {},
    };
    this.players.push(player);
    this.fetchWeapons(player);
  }

  removePlayer(index: number) {
    this.players.splice(index, 1);
    this.updateCombinedSets();
  }

  fetchWeapons(player: DestinyPlayer) {
    player.status = 'loading';

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
    )
      .pipe(
        switchMap((res) => {
          const playerRes = res.Response.filter(
            (p) => p.applicableMembershipTypes.length > 0
          )[0];
          console.log(playerRes);

          player.name = `${playerRes.bungieGlobalDisplayName}#${playerRes.bungieGlobalDisplayNameCode}`;

          return getProfile(
            (config) =>
              lastValueFrom(
                this.http.request(config.method, config.url, {
                  params: config.params,
                  body: config.body,
                })
              ),
            {
              destinyMembershipId: playerRes.membershipId,
              membershipType: playerRes.membershipType,
              components: [
                DestinyComponentType.CharacterEquipment,
                DestinyComponentType.CharacterInventories,
                DestinyComponentType.ProfileInventories,
                DestinyComponentType.Collectibles,
              ],
            }
          );
        }),
        map((res) => {
          console.log(res);

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

              if (collectible.state === DestinyCollectibleState.None) {
                this.sortCollectible(player, Number(collectibleHash));
              }
            });
          }

          player.status = 'ready';
          console.log(player);
          this.updateCombinedSets();
        })
      )
      .subscribe();
  }

  sortItem(player: DestinyPlayer, itemHash: number) {
    this.manifest.slotHashSet.forEach((slotHash) => {
      if (this.manifest.exoticLookup[slotHash].has(itemHash)) {
        player.exotics[slotHash]
          ? player.exotics[slotHash].add(itemHash)
          : (player.exotics[slotHash] = new Set([itemHash]));
      }
      if (this.manifest.nonExoticLookup[slotHash].has(itemHash)) {
        player.nonExotics[slotHash]
          ? player.nonExotics[slotHash].add(itemHash)
          : (player.nonExotics[slotHash] = new Set([itemHash]));
      }
      this.manifest.types[slotHash].forEach((typeHash) => {
        if (this.manifest.typesLookup[slotHash][typeHash].has(itemHash)) {
          if (!player.types[slotHash]) {
            player.types[slotHash] = {};
          }
          player.types[slotHash][typeHash]
            ? player.types[slotHash][typeHash].add(itemHash)
            : (player.types[slotHash][typeHash] = new Set([itemHash]));
        }
      });
      this.manifest.archetypes[slotHash].forEach((archetypeHash) => {
        if (
          this.manifest.archetypesLookup[slotHash][archetypeHash].has(itemHash)
        ) {
          if (!player.archetypes[slotHash]) {
            player.archetypes[slotHash] = {};
          }
          player.archetypes[slotHash][archetypeHash]
            ? player.archetypes[slotHash][archetypeHash].add(itemHash)
            : (player.archetypes[slotHash][archetypeHash] = new Set([
                itemHash,
              ]));
        }
      });
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

  dimType(type: string) {
    switch (type) {
      case 'Submachine Gun':
        return 'smg';
      case 'Combat Bow':
        return 'bow';
      default:
        return type.replace(/\s/g, '').toLowerCase();
    }
  }

  updateCombinedSets() {
    this.manifest.slotHashSet.forEach((slotHash) => {
      this.combinedSets.union.exotics[slotHash] = new Set();
      this.combinedSets.union.nonExotics[slotHash] = new Set();
      this.combinedSets.union.pullableExotics[slotHash] = new Set();
      this.combinedSets.union.pullableNonExotics[slotHash] = new Set();
      this.combinedSets.union.types[slotHash] = {};
      this.manifest.types[slotHash].forEach((typeHash) => {
        this.combinedSets.union.types[slotHash][typeHash] = new Set();
      });
      this.combinedSets.union.archetypes[slotHash] = {};
      this.manifest.archetypes[slotHash].forEach((archetypeHash) => {
        this.combinedSets.union.archetypes[slotHash][archetypeHash] = new Set();
      });
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
          this.manifest.types[slotHash].forEach((typeHash) => {
            this.combinedSets.union.types[slotHash][typeHash] = new Set([
              ...this.combinedSets.union.types[slotHash][typeHash],
              ...(player.types[slotHash][typeHash] || []),
            ]);
          });
          this.manifest.archetypes[slotHash].forEach((archetypeHash) => {
            this.combinedSets.union.archetypes[slotHash][archetypeHash] =
              new Set([
                ...this.combinedSets.union.archetypes[slotHash][archetypeHash],
                ...(player.archetypes[slotHash][archetypeHash] || []),
              ]);
          });
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
      this.combinedSets.intersection.types[slotHash] = {};
      this.manifest.types[slotHash].forEach((typeHash) => {
        this.combinedSets.intersection.types[slotHash][typeHash] = new Set([
          ...this.combinedSets.union.types[slotHash][typeHash],
        ]);
      });
      this.combinedSets.intersection.archetypes[slotHash] = {};
      this.manifest.archetypes[slotHash].forEach((archetypeHash) => {
        this.combinedSets.intersection.archetypes[slotHash][archetypeHash] =
          new Set([
            ...this.combinedSets.union.archetypes[slotHash][archetypeHash],
          ]);
      });
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
          this.manifest.types[slotHash].forEach((typeHash) => {
            this.combinedSets.intersection.types[slotHash][typeHash] = new Set(
              player.types[slotHash][typeHash]
                ? [
                    ...this.combinedSets.intersection.types[slotHash][typeHash],
                  ].filter((itemHash: number) =>
                    player.types[slotHash][typeHash].has(itemHash)
                  )
                : []
            );
          });
          this.manifest.archetypes[slotHash].forEach((archetypeHash) => {
            this.combinedSets.intersection.archetypes[slotHash][archetypeHash] =
              new Set(
                player.archetypes[slotHash][archetypeHash]
                  ? [
                      ...this.combinedSets.intersection.archetypes[slotHash][
                        archetypeHash
                      ],
                    ].filter((itemHash: number) =>
                      player.archetypes[slotHash][archetypeHash].has(itemHash)
                    )
                  : []
              );
          });
        });
      });

    console.log(this.combinedSets);
  }
}

export type DestinyPlayer = {
  name: string;
  lastImport?: Date;
  status: 'loading' | 'ready' | 'error';
  exotics: {
    [slotHash: number]: Set<number>;
  };
  nonExotics: {
    [slotHash: number]: Set<number>;
  };
  types: {
    [slotHash: number]: {
      [typeHash: number]: Set<number>;
    };
  };
  archetypes: {
    [slotHash: number]: {
      [archetypeHash: number]: Set<number>;
    };
  };
  pullableExotics: {
    [slotHash: number]: Set<number>;
  };
  pullableNonExotics: {
    [slotHash: number]: Set<number>;
  };
};
