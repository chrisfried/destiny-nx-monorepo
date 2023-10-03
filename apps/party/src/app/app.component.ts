import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { getCollectibleDef, getInventoryItemDef } from '@d2api/manifest';
import { getEquipmentSlotDef } from '@d2api/manifest-web';
import {
  DestinyAmmunitionType,
  DestinyInventoryItemDefinition,
} from 'bungie-api-ts/destiny2';
import { distinctUntilChanged, tap } from 'rxjs';
import { ManifestService } from './manifest/manifest.service';
import { PlayerComponent } from './player/player.component';
import { PlayerService } from './player/player.service';
import {
  WebringComponent,
  WebringSheetComponent,
} from './webring/webring.component';

@Component({
  selector: 'destiny-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    ClipboardModule,
    CommonModule,
    FormsModule,
    HttpClientModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    PlayerComponent,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    WebringComponent,
    WebringSheetComponent,
  ],
})
export class AppComponent {
  players;
  randomizationType: 'weaponSet' | 'archetypeSet' | 'typeSet' = 'weaponSet';
  exotics: 'exclude' | 'include' | 'required' = 'include';
  intersection;
  searchText = '';
  minPower = 0;
  discordWebhookUrl = '';
  discordThreadId = '';
  manifestState = 'loading';
  nameInput = '';
  collectionExotics = false;
  collectionNonExotics = false;
  requiresPull = false;
  requirePrimary = false;
  requireSpecial = false;
  weaponCount = 0;
  exoticCount = 0;
  nonExoticCount = 0;

  constructor(
    public playerService: PlayerService,
    private manifestService: ManifestService,
    private clipboard: Clipboard,
    private http: HttpClient
  ) {
    this.manifestService.state$.subscribe(
      (state) => (this.manifestState = state)
    );
    this.players = this.playerService.players;
    this.intersection = this.playerService.combinedSets.intersection;
    this.playerService.minPower.subscribe((value) => (this.minPower = value));
    this.playerService.combinedSetsLoading
      .pipe(
        distinctUntilChanged(),
        tap((loading) => {
          if (!loading) {
            this.updateCounts();
          }
        })
      )
      .subscribe();
  }

  changeMinPower(value: any) {
    if (!isNaN(parseInt(value.target.value))) {
      this.playerService.minPower.next(parseInt(value.target.value));
    } else {
      this.playerService.minPower.next(0);
    }
  }

  addPlayer() {
    this.playerService.addPlayer(this.nameInput);
    this.nameInput = '';
  }

  randomize() {
    this.searchText = '';
    this.requiresPull = false;

    const items: DestinyInventoryItemDefinition[] = [];

    const slotHashes = Array.from(this.manifestService.slotHashSet);
    slotHashes.sort(() => Math.random() - 0.5);

    let exoticAvailable = this.exotics;

    let requirePrimary = this.requirePrimary;
    let requireSpecial = this.requireSpecial;

    slotHashes.forEach((slotHash, i) => {
      const slot = getEquipmentSlotDef(slotHash);
      // Handle Exotic
      if (i === 0) {
        if (exoticAvailable === 'include') {
          const exoticRatio =
            this.intersection.pullableExotics[slotHash]?.size /
            (this.intersection.pullableExotics[slotHash]?.size +
              this.intersection.nonExotics[slotHash]?.size);
          exoticAvailable =
            Math.random() > exoticRatio ? 'exclude' : 'required';
        }
        if (exoticAvailable === 'required') {
          const pool = new Set([...this.intersection.exotics[slotHash]]);
          if (this.collectionExotics) {
            this.intersection.pullableExotics[slotHash].forEach(
              (collectibleHash) => {
                const collectible = getCollectibleDef(collectibleHash);
                if (collectible?.itemHash) {
                  pool.add(collectible.itemHash);
                }
              }
            );
          }
          const poolIndex = Math.floor(Math.random() * pool.size);
          const itemHash = Array.from(pool)[poolIndex];

          if (!this.intersection.exotics[slotHash].has(itemHash)) {
            this.requiresPull = true;
          }

          const item = getInventoryItemDef(itemHash);

          if (item) {
            items.push(item);
            if (
              item.equippingBlock?.ammoType === DestinyAmmunitionType.Primary
            ) {
              requirePrimary = false;
            }
            if (
              item.equippingBlock?.ammoType === DestinyAmmunitionType.Special
            ) {
              requireSpecial = false;
            }
          }

          exoticAvailable = 'exclude';

          return;
        }
      }

      let pool = new Set() as Set<number>;

      if (slot?.index !== 9 && requirePrimary) {
        pool = new Set(
          [...this.intersection.nonExotics[slotHash]].filter((itemHash) =>
            this.manifestService.ammoTypeLookup[
              DestinyAmmunitionType.Primary
            ].has(itemHash)
          )
        );
      } else if (slot?.index !== 9 && requireSpecial) {
        pool = new Set(
          [...this.intersection.nonExotics[slotHash]].filter((itemHash) =>
            this.manifestService.ammoTypeLookup[
              DestinyAmmunitionType.Special
            ].has(itemHash)
          )
        );
      } else {
        pool = new Set([...this.intersection.nonExotics[slotHash]]);
      }

      if (this.collectionNonExotics) {
        this.intersection.pullableNonExotics[slotHash].forEach(
          (collectibleHash) => {
            const collectible = getCollectibleDef(collectibleHash);
            if (collectible?.itemHash) {
              if (slot?.index !== 9 && requirePrimary) {
                if (
                  this.manifestService.ammoTypeLookup[
                    DestinyAmmunitionType.Primary
                  ].has(collectible.itemHash)
                ) {
                  pool.add(collectible.itemHash);
                }
              } else if (slot?.index !== 9 && requireSpecial) {
                if (
                  this.manifestService.ammoTypeLookup[
                    DestinyAmmunitionType.Special
                  ].has(collectible.itemHash)
                ) {
                  pool.add(collectible.itemHash);
                }
              } else {
                pool.add(collectible.itemHash);
              }
            }
          }
        );
      }
      const poolIndex = Math.floor(Math.random() * pool.size);
      const itemHash = Array.from(pool)[poolIndex];

      if (!this.intersection.nonExotics[slotHash].has(itemHash)) {
        this.requiresPull = true;
      }

      const item = getInventoryItemDef(itemHash);

      if (item) {
        items.push(item);
        if (item.equippingBlock?.ammoType === DestinyAmmunitionType.Primary) {
          requirePrimary = false;
        }
        if (item.equippingBlock?.ammoType === DestinyAmmunitionType.Special) {
          requireSpecial = false;
        }
      }
    });

    this.searchText = items
      .map((item) => {
        const splitName = item.displayProperties.name
          .split(' (')[0]
          .split('_v1')[0];

        const hashes =
          splitName && this.manifestService.nonExoticNameLookup[splitName]
            ? [...this.manifestService.nonExoticNameLookup[splitName]]
            : [item.hash];

        return `(${
          splitName ? splitName : item.displayProperties.name
        } (${hashes.map((hash) => `hash:${hash}`).join(' OR ')}))`;
      })
      .join(' OR ');

    this.clipboard.copy(this.searchText);
    if (this.discordWebhookUrl) {
      const url = this.discordThreadId
        ? `${this.discordWebhookUrl}?thread_id=${this.discordThreadId}`
        : this.discordWebhookUrl;
      this.http
        .post(url, {
          content: `\`\`\`${this.searchText}\`\`\``,
        })
        .subscribe();
    }
  }

  updateCounts(): void {
    this.exoticCount = this.getExoticCount();
    this.nonExoticCount = this.getNonExoticCount();
  }

  getExoticCount(): number {
    let countSet: Set<number> = new Set();
    this.manifestService.slotHashSet.forEach((slotHash) => {
      if (this.exotics !== 'exclude' && this.intersection.exotics[slotHash]) {
        countSet = new Set([
          ...countSet,
          ...this.intersection.exotics[slotHash],
        ]);
      }
      if (
        this.exotics !== 'exclude' &&
        this.collectionExotics &&
        this.intersection.pullableExotics[slotHash]
      ) {
        this.intersection.pullableExotics[slotHash].forEach(
          (collectibleHash) => {
            const collectible = getCollectibleDef(collectibleHash);
            if (collectible) {
              countSet.add(collectible?.itemHash);
            }
          }
        );
      }
    });
    return countSet.size;
  }

  getNonExoticCount(): number {
    let countSet: Set<number> = new Set();
    this.manifestService.slotHashSet.forEach((slotHash) => {
      if (this.intersection.nonExotics[slotHash]) {
        countSet = new Set([
          ...countSet,
          ...this.intersection.nonExotics[slotHash],
        ]);
      }
      if (
        this.collectionNonExotics &&
        this.intersection.pullableNonExotics[slotHash]
      ) {
        this.intersection.pullableNonExotics[slotHash].forEach(
          (collectibleHash) => {
            const collectible = getCollectibleDef(collectibleHash);
            if (collectible) {
              countSet.add(collectible?.itemHash);
            }
          }
        );
      }
    });
    return countSet.size;
  }
}
