import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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

  constructor(private playerService: PlayerService) {}

  refreshPlayer() {
    this.playerService.fetchWeapons(this.player);
  }

  removePlayer() {
    this.playerService.removePlayer(this.index);
  }

  getWeaponCount(): number {
    let count = 0;
    const exoticKeys = Object.keys(this.player.exotics);
    const nonExoticKeys = Object.keys(this.player.nonExotics);
    exoticKeys.forEach((key) => {
      count += this.player.exotics[Number(key)].size;
    });
    nonExoticKeys.forEach((key) => {
      count += this.player.nonExotics[Number(key)].size;
    });
    return count;
  }

  getExoticCount(): number {
    let count = 0;
    const slotHashes = Object.keys(this.player.exotics);
    slotHashes.forEach((slotHash) => {
      count += this.player.exotics[Number(slotHash)].size;
    });
    return count;
  }

  getNonExoticCount(): number {
    let count = 0;
    const slotHashes = Object.keys(this.player.nonExotics);
    slotHashes.forEach((slotHash) => {
      count += this.player.nonExotics[Number(slotHash)].size;
    });
    return count;
  }

  getPullableExoticCount(): number {
    let count = 0;
    const slotHashes = Object.keys(this.player.pullableExotics);
    slotHashes.forEach((slotHash) => {
      count += this.player.pullableExotics[Number(slotHash)].size;
    });
    return count;
  }

  getPullableNonExoticCount(): number {
    let count = 0;
    const slotHashes = Object.keys(this.player.pullableNonExotics);
    slotHashes.forEach((slotHash) => {
      count += this.player.pullableNonExotics[Number(slotHash)].size;
    });
    return count;
  }

  // getArchetypeCount(): number {
  //   let count = 0;
  //   const slotHashes = Object.keys(this.player.archetypes);
  //   slotHashes.forEach((slotHash) => {
  //     count += Object.keys(this.player.archetypes[Number(slotHash)]).length;
  //   });
  //   return count;
  // }

  // getTypeCount(): number {
  //   let count = 0;
  //   const slotHashes = Object.keys(this.player.types);
  //   slotHashes.forEach((slotHash) => {
  //     count += Object.keys(this.player.types[Number(slotHash)]).length;
  //   });
  //   return count;
  // }
}
