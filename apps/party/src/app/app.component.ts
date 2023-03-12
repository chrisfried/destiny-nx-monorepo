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
import { MatRadioModule } from '@angular/material/radio';
import { DestinyInventoryItemDefinition } from 'bungie-api-ts/destiny2';
// import { BungieAuthService } from './bungie-auth/bungie-auth.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ManifestService } from './manifest/manifest.service';
import { PlayerComponent } from './player/player.component';
import { PlayerService } from './player/player.service';

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
  collectionExotics = true;
  collectionNonExotics = false;
  requiresPull = false;

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

    slotHashes.forEach((slotHash, i) => {
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
                const collectible =
                  this.manifestService.defs.Collectible?.get(collectibleHash);
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

          const item = this.manifestService.defs.InventoryItem?.get(itemHash);

          if (item) {
            items.push(item);
          }

          exoticAvailable = 'exclude';

          return;
        }
      }

      const pool = new Set([...this.intersection.nonExotics[slotHash]]);
      if (this.collectionNonExotics) {
        this.intersection.pullableNonExotics[slotHash].forEach(
          (collectibleHash) => {
            const collectible =
              this.manifestService.defs.Collectible?.get(collectibleHash);
            if (collectible?.itemHash) {
              pool.add(collectible.itemHash);
            }
          }
        );
      }
      const poolIndex = Math.floor(Math.random() * pool.size);
      const itemHash = Array.from(pool)[poolIndex];

      if (!this.intersection.nonExotics[slotHash].has(itemHash)) {
        this.requiresPull = true;
      }

      const item = this.manifestService.defs.InventoryItem?.get(itemHash);

      if (item) {
        items.push(item);
      }
    });

    this.searchText = items
      .map((item) => `(${item.displayProperties.name} hash:${item.hash})`)
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

    console.log(items);
  }

  getWeaponCount(): number {
    let count = 0;
    const exoticKeys = Object.keys(this.intersection.exotics);
    const nonExoticKeys = Object.keys(this.intersection.nonExotics);
    exoticKeys.forEach((key) => {
      count += this.intersection.exotics[Number(key)].size;
    });
    nonExoticKeys.forEach((key) => {
      count += this.intersection.nonExotics[Number(key)].size;
    });
    return count;
  }

  getExoticCount(): number {
    let count = 0;
    const slotHashes = Object.keys(this.intersection.exotics);
    slotHashes.forEach((slotHash) => {
      count += this.intersection.exotics[Number(slotHash)].size;
    });
    return count;
  }

  getNonExoticCount(): number {
    let count = 0;
    const slotHashes = Object.keys(this.intersection.nonExotics);
    slotHashes.forEach((slotHash) => {
      count += this.intersection.nonExotics[Number(slotHash)].size;
    });
    return count;
  }

  getPullableExoticCount(): number {
    let count = 0;
    const slotHashes = Object.keys(this.intersection.pullableExotics);
    slotHashes.forEach((slotHash) => {
      count += this.intersection.pullableExotics[Number(slotHash)].size;
    });
    return count;
  }

  getPullableNonExoticCount(): number {
    let count = 0;
    const slotHashes = Object.keys(this.intersection.pullableNonExotics);
    slotHashes.forEach((slotHash) => {
      count += this.intersection.pullableNonExotics[Number(slotHash)].size;
    });
    return count;
  }

  // getArchetypeCount(): number {
  //   let count = 0;
  //   const slotHashes = Object.keys(this.intersection.archetypes);
  //   slotHashes.forEach((slotHash) => {
  //     count += Object.keys(
  //       this.intersection.archetypes[Number(slotHash)]
  //     ).filter(
  //       (key) =>
  //         this.intersection.archetypes[Number(slotHash)][Number(key)].size > 0
  //     ).length;
  //   });
  //   return count;
  // }

  // getTypeCount(): number {
  //   let count = 0;
  //   const slotHashes = Object.keys(this.intersection.types);
  //   slotHashes.forEach((slotHash) => {
  //     count += Object.keys(this.intersection.types[Number(slotHash)]).filter(
  //       (key) => this.intersection.types[Number(slotHash)][Number(key)].size > 0
  //     ).length;
  //   });
  //   return count;
  // }
}
