import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  getCollectibleDef,
  getInventoryItemDef,
  getPresentationNodeDef,
} from '@d2api/manifest';
import {
  includeTables,
  loadDefs,
  setApiKey,
  setLanguage,
} from '@d2api/manifest-web';
import { getCommonSettings } from 'bungie-api-ts/core';
import { DestinyClass, destinyManifestLanguages } from 'bungie-api-ts/destiny2';
import { BehaviorSubject, EMPTY, from, lastValueFrom } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  map,
  switchMap,
} from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ManifestService {
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
  nonExoticNameLookup: {
    [name: string]: Set<number>;
  } = {};

  ammoTypeSet = new Set<number>();
  ammoTypeLookup: {
    [ammo: number]: Set<number>;
  } = {};

  pullableExotics: {
    [slotHash: number]: Set<number>;
  } = {};
  pullableNonExotics: {
    [slotHash: number]: Set<number>;
  } = {};

  constructor(private http: HttpClient) {
    setLanguage(
      destinyManifestLanguages.find(
        (l) =>
          l === navigator.language || l === navigator.language.split('-')[0]
      ) ?? 'en'
    );
    setApiKey(environment.bungie.apiKey);
    includeTables([
      'Collectible',
      'InventoryBucket',
      'InventoryItem',
      'PresentationNode',
      'EquipmentSlot',
    ]);

    this.loadManifest();

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
          const itemsNode = getPresentationNodeDef(
            res.Response.destiny2CoreSettings.collectionRootNode
          );
          if (itemsNode?.children.presentationNodes[0].presentationNodeHash) {
            const exoticNode = getPresentationNodeDef(
              itemsNode?.children.presentationNodes[0].presentationNodeHash
            );
            if (
              exoticNode?.children.presentationNodes[0].presentationNodeHash
            ) {
              const exoticWeaponsNode = getPresentationNodeDef(
                exoticNode?.children.presentationNodes[0].presentationNodeHash
              );
              exoticWeaponsNode?.children.presentationNodes.forEach((n, i) => {
                const weaponSlotNode = getPresentationNodeDef(
                  n.presentationNodeHash
                );
                weaponSlotNode?.children.collectibles.forEach((c) => {
                  const collectible = getCollectibleDef(c.collectibleHash);
                  const item = collectible?.itemHash
                    ? getInventoryItemDef(collectible?.itemHash)
                    : undefined;
                  const slotHash = item?.equippingBlock?.equipmentSlotTypeHash;
                  const ammoType = item?.equippingBlock?.ammoType;

                  if (
                    slotHash &&
                    ammoType &&
                    item.hash &&
                    item.classType === DestinyClass.Unknown
                  ) {
                    this.slotHashSet.add(slotHash);
                    this.exoticLookup[slotHash]
                      ? this.exoticLookup[slotHash].add(item.hash)
                      : (this.exoticLookup[slotHash] = new Set([item.hash]));

                    this.ammoTypeSet.add(ammoType);
                    this.ammoTypeLookup[ammoType]
                      ? this.ammoTypeLookup[ammoType].add(item.hash)
                      : (this.ammoTypeLookup[ammoType] = new Set([item.hash]));

                    if (
                      collectible?.acquisitionInfo
                        ?.acquireMaterialRequirementHash
                    ) {
                      this.pullableExotics[slotHash]
                        ? this.pullableExotics[slotHash].add(collectible.hash)
                        : (this.pullableExotics[slotHash] = new Set([
                            collectible.hash,
                          ]));
                    }
                  }
                });
              });
            }
            const weaponsNode = getPresentationNodeDef(
              itemsNode?.children.presentationNodes[1].presentationNodeHash
            );
            for (let i = 0; i < 3; i++) {
              if (
                weaponsNode?.children.presentationNodes[i].presentationNodeHash
              ) {
                const weaponSlotNode = getPresentationNodeDef(
                  weaponsNode?.children.presentationNodes[i]
                    .presentationNodeHash
                );
                weaponSlotNode?.children.presentationNodes.forEach((t) => {
                  const weaponTypeNode = getPresentationNodeDef(
                    t.presentationNodeHash
                  );
                  weaponTypeNode?.children.collectibles.forEach((c) => {
                    const collectible = getCollectibleDef(c.collectibleHash);
                    const item = collectible?.itemHash
                      ? getInventoryItemDef(collectible?.itemHash)
                      : undefined;
                    const slotHash =
                      item?.equippingBlock?.equipmentSlotTypeHash;
                    const ammoType = item?.equippingBlock?.ammoType;

                    if (
                      slotHash &&
                      ammoType &&
                      item.hash &&
                      item.classType === DestinyClass.Unknown
                    ) {
                      this.slotHashSet.add(slotHash);
                      this.nonExoticLookup[slotHash]
                        ? this.nonExoticLookup[slotHash].add(item.hash)
                        : (this.nonExoticLookup[slotHash] = new Set([
                            item.hash,
                          ]));

                      this.ammoTypeSet.add(ammoType);
                      this.ammoTypeLookup[ammoType]
                        ? this.ammoTypeLookup[ammoType].add(item.hash)
                        : (this.ammoTypeLookup[ammoType] = new Set([
                            item.hash,
                          ]));

                      const splitName = item.displayProperties.name
                        .split(' (')[0]
                        .split('_v1')[0];

                      this.nonExoticNameLookup[splitName]
                        ? this.nonExoticNameLookup[splitName].add(item.hash)
                        : (this.nonExoticNameLookup[splitName] = new Set([
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
                    }
                  });
                });
              }
            }
          }
          this.state$.next('ready');
        }),
        catchError((e, caught) => {
          const message = e.message || e;
          console.error(message);
          this.state$.next('erred');
          return EMPTY;
        })
      )
      .subscribe();
  }

  async loadManifest() {
    try {
      await loadDefs();
      this.manifestState$.next('ready');
    } catch (e) {
      this.manifestState$.next('erred');
    }
  }
}
