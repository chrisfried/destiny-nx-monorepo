import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { getCollectibleDef } from '@d2api/manifest';
import { UserInfoCard } from 'bungie-api-ts/user/interfaces';
import { ManifestService } from '../manifest/manifest.service';
import { DestinyPlayer, PlayerService } from './player.service';
@Component({
  selector: 'destiny-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatListModule,
    MatProgressSpinnerModule,
  ],
})
export class PlayerComponent {
  @Input() player!: DestinyPlayer;
  @Input() index = 0;
  @Input() exotics!: 'exclude' | 'include' | 'required';
  @Input() collectionExotics = false;
  @Input() collectionNonExotics = false;

  constructor(
    private playerService: PlayerService,
    private manifestService: ManifestService
  ) {}

  refreshPlayer() {
    if (this.player.status === 'ready') {
      this.playerService.fetchWeapons(this.player);
    } else {
      this.playerService.findDestinyMembership(this.player);
    }
  }

  removePlayer() {
    this.playerService.removePlayer(this.index);
  }

  selectMembership(membership: UserInfoCard) {
    this.player.name = membership.bungieGlobalDisplayName;
    this.player.nameCode = membership.bungieGlobalDisplayNameCode;
    this.player.membershipType = membership.membershipType;
    this.player.membershipId = membership.membershipId;
    this.playerService.fetchWeapons(this.player);
  }

  getWeaponCount(): number {
    let countSet = new Set();
    this.manifestService.slotHashSet.forEach((slotHash) => {
      if (this.exotics !== 'exclude') {
        if (this.player.exotics[slotHash]) {
          countSet = new Set([...countSet, ...this.player.exotics[slotHash]]);
        }
        if (this.collectionExotics && this.player.pullableExotics[slotHash]) {
          this.player.pullableExotics[slotHash].forEach((collectibleHash) => {
            const collectible = getCollectibleDef(collectibleHash);
            countSet.add(collectible?.itemHash);
          });
        }
      }
      if (this.player.nonExotics[slotHash]) {
        countSet = new Set([...countSet, ...this.player.nonExotics[slotHash]]);
      }
      if (
        this.collectionNonExotics &&
        this.player.pullableNonExotics[slotHash]
      ) {
        this.player.pullableNonExotics[slotHash].forEach((collectibleHash) => {
          const collectible = getCollectibleDef(collectibleHash);
          countSet.add(collectible?.itemHash);
        });
      }
    });
    return countSet.size;
  }

  getExoticCount(): number {
    let countSet = new Set();
    this.manifestService.slotHashSet.forEach((slotHash) => {
      if (this.player.exotics[slotHash]) {
        countSet = new Set([...countSet, ...this.player.exotics[slotHash]]);
      }
      if (this.collectionExotics && this.player.pullableExotics[slotHash]) {
        this.player.pullableExotics[slotHash].forEach((collectibleHash) => {
          const collectible = getCollectibleDef(collectibleHash);
          countSet.add(collectible?.itemHash);
        });
      }
    });
    return countSet.size;
  }

  getNonExoticCount(): number {
    let countSet = new Set();
    this.manifestService.slotHashSet.forEach((slotHash) => {
      if (this.player.nonExotics[slotHash]) {
        countSet = new Set([...countSet, ...this.player.nonExotics[slotHash]]);
      }
      if (
        this.collectionNonExotics &&
        this.player.pullableNonExotics[slotHash]
      ) {
        this.player.pullableNonExotics[slotHash].forEach((collectibleHash) => {
          const collectible = getCollectibleDef(collectibleHash);
          countSet.add(collectible?.itemHash);
        });
      }
    });
    return countSet.size;
  }
}
