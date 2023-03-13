import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  getCollectibleDef,
  getInventoryItemDef,
  getPresentationNodeDef,
} from '@d2api/manifest';
import { includeTables, loadDefs, setApiKey } from '@d2api/manifest-web';
import { getCommonSettings } from 'bungie-api-ts/core';
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

  pullableExotics: {
    [slotHash: number]: Set<number>;
  } = {};
  pullableNonExotics: {
    [slotHash: number]: Set<number>;
  } = {};

  constructor(private http: HttpClient) {
    setApiKey(environment.bungie.apiKey);
    includeTables([
      'Collectible',
      'InventoryBucket',
      'InventoryItem',
      'PresentationNode',
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
                    }
                  });
                });
              }
            }
          }
          console.log('Slot Hash Set', this.slotHashSet);
          console.log('Exotic Lookup', this.exoticLookup);
          console.log('Non-Exotic Lookup', this.nonExoticLookup);

          console.log('Pullable Exotics', this.pullableExotics);
          console.log('Pullable Non-Exotics', this.pullableNonExotics);
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
