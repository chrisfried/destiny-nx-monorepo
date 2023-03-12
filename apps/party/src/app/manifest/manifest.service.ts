import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getCommonSettings } from 'bungie-api-ts/core';
import {
  DestinyCollectibleDefinition,
  DestinyInventoryBucketDefinition,
  DestinyInventoryItemDefinition,
  DestinyManifest,
  DestinyPresentationNodeDefinition,
  getDestinyManifest,
  ServerResponse,
} from 'bungie-api-ts/destiny2';
import { deepEqual } from 'fast-equals';
import { del, get, set } from 'idb-keyval';
import { BehaviorSubject, EMPTY, from, lastValueFrom, Subject } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  map,
  switchMap,
} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ManifestService {
  alwaysLoadRemote = false;

  version: string | null = null;

  manifestState$ = new BehaviorSubject<'loading' | 'ready' | 'erred'>(
    'loading'
  );
  state$ = new BehaviorSubject<'loading' | 'ready' | 'erred'>('loading');

  slotHashSet = new Set<number>();
  exoticLookup: {
    [slotHash: number]: Set<number>;
  } = {};
  nonExoticLookup: {
    [slotHash: number]: Set<number>;
  } = {};
  types: {
    [slotHash: number]: Set<number>;
  } = {};
  typesLookup: {
    [slotHash: number]: {
      [typeHash: number]: Set<number>;
    };
  } = {};
  // archetypes: {
  //   [slotHash: number]: Set<number>;
  // } = {};
  // archetypesLookup: {
  //   [slotHash: number]: {
  //     [archetypeHash: number]: Set<number>;
  //   };
  // } = {};

  pullableExotics: {
    [slotHash: number]: Set<number>;
  } = {};
  pullableNonExotics: {
    [slotHash: number]: Set<number>;
  } = {};

  /** A signal for when we've loaded a new remote manifest. */
  newManifest$ = new Subject();
  defs: {
    Collectible?: {
      get(hash: number): DestinyCollectibleDefinition;
    };
    InventoryBucket?: {
      get(hash: number): DestinyInventoryBucketDefinition;
    };
    InventoryItem?: {
      get(hash: number): DestinyInventoryItemDefinition;
    };
    PresentationNode?: {
      get(hash: number): DestinyPresentationNodeDefinition;
    };
  } = {};

  private localStorageKey = 'd2-manifest-version';
  private idbKey = 'd2-manifest';

  constructor(private http: HttpClient) {
    const tables = [
      'Collectible',
      'InventoryBucket',
      'InventoryItem',
      'PresentationNode',
    ];

    from(
      getDestinyManifest((config) =>
        lastValueFrom(
          this.http.request(config.method, config.url, {
            params: config.params,
            body: config.body,
          })
        )
      )
    )
      .pipe(
        switchMap((res: ServerResponse<DestinyManifest>) => {
          const data = res.Response;
          // await settingsReady; // wait for settings to be ready
          const language = 'en';
          const path =
            data.jsonWorldContentPaths[language] ||
            data.jsonWorldContentPaths.en;

          // Use the path as the version, rather than the "version" field, because
          // Bungie can update the manifest file without changing that version.
          const version = path;
          this.version = version;

          try {
            if (this.alwaysLoadRemote) {
              throw new Error('Testing - always load remote');
            }

            // this.statusText = `${t('Manifest.Load')}...`;
            const currentManifestVersion = localStorage.getItem(
              this.localStorageKey
            );
            const currentWhitelist = JSON.parse(
              localStorage.getItem(this.localStorageKey + '-whitelist') || '[]'
            );
            if (
              currentManifestVersion === version &&
              deepEqual(currentWhitelist, tables)
            ) {
              const manifest = get<object>(this.idbKey);
              if (!manifest) {
                throw new Error('Empty cached manifest file');
              }
              return manifest;
            } else {
              throw new Error(
                `version mismatch: ${version} ${currentManifestVersion}`
              );
            }
          } catch (e) {
            return this.http
              .get(`https://www.bungie.net${path}`, { withCredentials: false })
              .pipe(
                map((response: any) => {
                  const manifest = {
                    DestinyCollectibleDefinition:
                      response['DestinyCollectibleDefinition'],
                    DestinyInventoryBucketDefinition:
                      response['DestinyInventoryBucketDefinition'],
                    DestinyInventoryItemDefinition:
                      response['DestinyInventoryItemDefinition'],
                    DestinyPresentationNodeDefinition:
                      response['DestinyPresentationNodeDefinition'],
                  };

                  // We intentionally don't wait on this promise
                  this.saveManifestToIndexedDB(manifest, version, tables);

                  this.newManifest$.next(1);
                  return manifest;
                })
              );
          }
        }),
        map((manifest) => {
          manifest = manifest as {
            DestinyCollectibleDefinition: any;
            DestinyInventoryBucketDefinition: any;
            DestinyInventoryItemDefinition: any;
            DestinyPresentationNodeDefinition: any;
          };
          if (
            !manifest ||
            !(manifest as { DestinyInventoryItemDefinition: any })
              .DestinyInventoryItemDefinition
          ) {
            throw new Error('Manifest corrupted, please reload');
          }
          this.defs.Collectible = {
            get(hash: number) {
              const dbTable = (
                manifest as { DestinyCollectibleDefinition: any }
              )?.DestinyCollectibleDefinition;
              if (!dbTable) {
                throw new Error(
                  `Table DestinyCollectibleDefinition does not exist in the manifest`
                );
              }
              return dbTable[hash];
            },
          };
          this.defs.InventoryBucket = {
            get(hash: number) {
              const dbTable = (
                manifest as { DestinyInventoryBucketDefinition: any }
              )?.DestinyInventoryBucketDefinition;
              if (!dbTable) {
                throw new Error(
                  `Table DestinyInventoryBucketDefinition does not exist in the manifest`
                );
              }
              return dbTable[hash];
            },
          };
          this.defs.InventoryItem = {
            get(hash: number) {
              const dbTable = (
                manifest as { DestinyInventoryItemDefinition: any }
              )?.DestinyInventoryItemDefinition;
              if (!dbTable) {
                throw new Error(
                  `Table DestinyInventoryItemDefinition does not exist in the manifest`
                );
              }
              return dbTable[hash];
            },
          };
          this.defs.PresentationNode = {
            get(hash: number) {
              const dbTable = (
                manifest as { DestinyPresentationNodeDefinition: any }
              )?.DestinyPresentationNodeDefinition;
              if (!dbTable) {
                throw new Error(
                  `Table DestinyPresentationNodeDefinition does not exist in the manifest`
                );
              }
              return dbTable[hash];
            },
          };
          this.manifestState$.next('ready');
        }),
        catchError((e, caught) => {
          const message = e.message || e;
          console.error(message);

          if (e instanceof TypeError || e.status === -1) {
            // message = navigator.onLine
            //   ? t('BungieService.NotConnectedOrBlocked')
            //   : t('BungieService.NotConnected');
          } else if (e.status === 503 || e.status === 522 /* cloudflare */) {
            // message = t('BungieService.Difficulties');
          } else if (e.status < 200 || e.status >= 400) {
            // message = t('BungieService.NetworkError', {
            //   status: e.status,
            //   statusText: e.statusText
            // });
          } else {
            // Something may be wrong with the manifest
            this.deleteManifestFile();
          }

          this.manifestState$.next('erred');
          return EMPTY;
        })
      )
      .subscribe();

    this.manifestState$
      .pipe(
        distinctUntilChanged(),
        switchMap((state) => {
          if (state === 'erred') {
            this.state$.next('erred');
          }

          if (state === 'ready') {
            return from(
              getCommonSettings((config) =>
                lastValueFrom(
                  this.http.request(config.method, config.url, {
                    params: config.params,
                    body: config.body,
                  })
                )
              )
            );
          }

          return EMPTY;
        }),
        map((res) => {
          const itemsNode = this.defs.PresentationNode?.get(
            res.Response.destiny2CoreSettings.collectionRootNode
          );
          if (itemsNode?.children.presentationNodes[0].presentationNodeHash) {
            const exoticNode = this.defs.PresentationNode?.get(
              itemsNode?.children.presentationNodes[0].presentationNodeHash
            );
            if (
              exoticNode?.children.presentationNodes[0].presentationNodeHash
            ) {
              const exoticWeaponsNode = this.defs.PresentationNode?.get(
                exoticNode?.children.presentationNodes[0].presentationNodeHash
              );
              exoticWeaponsNode?.children.presentationNodes.forEach((n, i) => {
                const weaponSlotNode = this.defs.PresentationNode?.get(
                  n.presentationNodeHash
                );
                weaponSlotNode?.children.collectibles.forEach((c) => {
                  const collectible = this.defs.Collectible?.get(
                    c.collectibleHash
                  );
                  const item = collectible?.itemHash
                    ? this.defs.InventoryItem?.get(collectible?.itemHash)
                    : undefined;

                  if (item?.equippingBlock?.equipmentSlotTypeHash) {
                    this.slotHashSet.add(
                      item?.equippingBlock?.equipmentSlotTypeHash
                    );

                    this.exoticLookup[
                      item?.equippingBlock?.equipmentSlotTypeHash
                    ]
                      ? this.exoticLookup[
                          item?.equippingBlock?.equipmentSlotTypeHash
                        ].add(item.hash)
                      : (this.exoticLookup[
                          item?.equippingBlock?.equipmentSlotTypeHash
                        ] = new Set([item.hash]));

                    if (
                      collectible?.acquisitionInfo
                        ?.acquireMaterialRequirementHash
                    ) {
                      this.pullableExotics[
                        item?.equippingBlock?.equipmentSlotTypeHash
                      ]
                        ? this.pullableExotics[
                            item?.equippingBlock?.equipmentSlotTypeHash
                          ].add(collectible.hash)
                        : (this.pullableExotics[
                            item?.equippingBlock?.equipmentSlotTypeHash
                          ] = new Set([collectible.hash]));
                    }
                  }
                });
              });
            }
            const weaponsNode = this.defs.PresentationNode?.get(
              itemsNode?.children.presentationNodes[1].presentationNodeHash
            );
            for (let i = 0; i < 3; i++) {
              if (
                weaponsNode?.children.presentationNodes[i].presentationNodeHash
              ) {
                const weaponSlotNode = this.defs.PresentationNode?.get(
                  weaponsNode?.children.presentationNodes[i]
                    .presentationNodeHash
                );
                weaponSlotNode?.children.presentationNodes.forEach((t) => {
                  const weaponTypeNode = this.defs.PresentationNode?.get(
                    t.presentationNodeHash
                  );
                  weaponTypeNode?.children.collectibles.forEach((c) => {
                    const collectible = this.defs.Collectible?.get(
                      c.collectibleHash
                    );
                    const item = collectible?.itemHash
                      ? this.defs.InventoryItem?.get(collectible?.itemHash)
                      : undefined;
                    const slotHash =
                      item?.equippingBlock?.equipmentSlotTypeHash;

                    if (slotHash && item.hash) {
                      this.slotHashSet.add(slotHash);
                      this.nonExoticLookup[slotHash]
                        ? this.nonExoticLookup[slotHash].add(item.hash)
                        : (this.nonExoticLookup[slotHash] = new Set([
                            item.hash,
                          ]));

                      if (
                        collectible?.acquisitionInfo
                          ?.acquireMaterialRequirementHash
                      ) {
                        this.pullableNonExotics[slotHash]
                          ? this.pullableNonExotics[slotHash].add(
                              collectible.hash
                            )
                          : (this.pullableNonExotics[slotHash] = new Set([
                              collectible.hash,
                            ]));
                      }

                      // const itemCategory = item.itemCategoryHashes
                      //   ? item.itemCategoryHashes[
                      //       item.itemCategoryHashes.length - 1
                      //     ]
                      //   : undefined;

                      // if (itemCategory) {
                      //   this.types[slotHash]
                      //     ? this.types[slotHash].add(itemCategory)
                      //     : (this.types[slotHash] = new Set([itemCategory]));

                      //   if (!this.typesLookup[slotHash]) {
                      //     this.typesLookup[slotHash] = {};
                      //   }

                      //   this.typesLookup[slotHash][itemCategory]
                      //     ? this.typesLookup[slotHash][itemCategory].add(
                      //         item.hash
                      //       )
                      //     : (this.typesLookup[slotHash][itemCategory] = new Set(
                      //         [item.hash]
                      //       ));
                      // }

                      // const archetypeHash =
                      //   item.sockets?.socketEntries[0].singleInitialItemHash;
                      // if (archetypeHash) {
                      //   this.archetypes[slotHash]
                      //     ? this.archetypes[slotHash].add(archetypeHash)
                      //     : (this.archetypes[slotHash] = new Set([
                      //         archetypeHash,
                      //       ]));

                      //   if (!this.archetypesLookup[slotHash]) {
                      //     this.archetypesLookup[slotHash] = {};
                      //   }

                      //   this.archetypesLookup[slotHash][archetypeHash]
                      //     ? this.archetypesLookup[slotHash][archetypeHash].add(
                      //         item.hash
                      //       )
                      //     : (this.archetypesLookup[slotHash][archetypeHash] =
                      //         new Set([item.hash]));
                      // }
                    }
                  });
                });
              }
            }
          }
          console.log('Slot Hash Set', this.slotHashSet);
          console.log('Exotic Lookup', this.exoticLookup);
          console.log('Non-Exotic Lookup', this.nonExoticLookup);
          console.log('(Non-Exotic) Types', this.types);
          console.log('(Non-Exotic) Types Lookup', this.typesLookup);
          // console.log('(Non-Exotic) Archetypes', this.archetypes);
          // console.log('(Non-Exotic) Archetypes Lookup', this.archetypesLookup);

          console.log('Pullable Exotics', this.pullableExotics);
          console.log('Pullable Non-Exotics', this.pullableNonExotics);
          this.state$.next('ready');
        }),
        catchError((e, caught) => {
          const message = e.message || e;
          console.error(message);

          if (e instanceof TypeError || e.status === -1) {
            // message = navigator.onLine
            //   ? t('BungieService.NotConnectedOrBlocked')
            //   : t('BungieService.NotConnected');
          } else if (e.status === 503 || e.status === 522 /* cloudflare */) {
            // message = t('BungieService.Difficulties');
          } else if (e.status < 200 || e.status >= 400) {
            // message = t('BungieService.NetworkError', {
            //   status: e.status,
            //   statusText: e.statusText
            // });
          } else {
            // Something may be wrong with the manifest
            this.deleteManifestFile();
          }

          this.state$.next('erred');
          return EMPTY;
        })
      )
      .subscribe();
  }

  // This is not an anonymous arrow function inside loadManifestRemote because of https://bugs.webkit.org/show_bug.cgi?id=166879
  private async saveManifestToIndexedDB(
    typedArray: object,
    version: string,
    tableWhitelist: string[]
  ) {
    try {
      await set(this.idbKey, typedArray);
      localStorage.setItem(this.localStorageKey, version);
      localStorage.setItem(
        this.localStorageKey + '-whitelist',
        JSON.stringify(tableWhitelist)
      );
    } catch (e) {
      console.error('Error saving manifest file', e);
    }
  }

  private deleteManifestFile() {
    localStorage.removeItem(this.localStorageKey);
    del(this.idbKey);
  }
}
