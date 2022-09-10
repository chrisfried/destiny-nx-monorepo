import { Component } from '@angular/core';
import { PlayerService } from './player/player.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'destiny-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  players;
  randomizationType: 'weaponSet' | 'archetypeSet' | 'typeSet' = 'weaponSet';
  exotics: 'exclude' | 'include' | 'required' = 'include';
  intersection;
  searchText = '';
  minPower = 0;
  discordWebhookUrl = '';

  constructor(
    private playerService: PlayerService,
    private clipboard: Clipboard,
    private http: HttpClient
  ) {
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
    this.playerService.addPlayer();
  }

  randomize() {
    const slots: Array<'kineticSlot' | 'energySlot' | 'powerSlot'> = [
      'kineticSlot',
      'energySlot',
      'powerSlot',
    ];
    slots.sort(() => Math.random() - 0.5);
    let exoticAvailable = this.exotics;
    const items: string[] = [];
    slots.forEach((slot) => {
      if (this.randomizationType === 'typeSet') {
        if (exoticAvailable === 'required') {
          const source = this.intersection[slot].exoticTypeSet;
          console.log(this.intersection[slot]);
          const index = Math.floor(Math.random() * source.size);
          items.push(`(${Array.from(source)[index]} is:exotic)`);
          exoticAvailable = 'exclude';
        } else if (exoticAvailable === 'include') {
          const source = new Set([
            ...this.intersection[slot][this.randomizationType],
            ...this.intersection[slot].exoticTypeSet,
          ]);
          console.log(
            this.intersection[slot][this.randomizationType].size,
            this.intersection[slot].exoticTypeSet.size,
            source.size
          );
          const index = Math.floor(Math.random() * source.size);
          items.push(`(${Array.from(source)[index]})`);
        } else {
          const source = this.intersection[slot][this.randomizationType];
          const index = Math.floor(Math.random() * source.size);
          items.push(`(${Array.from(source)[index]} -is:exotic)`);
        }
      } else {
        if (exoticAvailable === 'required') {
          const source = this.intersection[slot].exoticSet;
          const index = Math.floor(Math.random() * source.size);
          items.push(`(${Array.from(source)[index]})`);
          exoticAvailable = 'exclude';
        } else if (exoticAvailable === 'include') {
          const nonExoticSize =
            this.intersection[slot][this.randomizationType].size;
          const source = new Set([
            ...this.intersection[slot][this.randomizationType],
            ...this.intersection[slot].exoticSet,
          ]);
          const index = Math.floor(Math.random() * source.size);
          items.push(`(${Array.from(source)[index]})`);
          if (index > nonExoticSize) {
            exoticAvailable = 'exclude';
          }
        } else {
          const source = this.intersection[slot][this.randomizationType];
          const index = Math.floor(Math.random() * source.size);
          items.push(`(${Array.from(source)[index]})`);
        }
      }
    });
    this.searchText = `(${items.join(' or ')})${
      this.minPower ? ` power:>=${this.minPower}` : ``
    }`;
    this.clipboard.copy(this.searchText);
    if (this.discordWebhookUrl) {
      this.http
        .post(this.discordWebhookUrl, {
          content: `\`\`\`${this.searchText}\`\`\``,
        })
        .subscribe();
    }
  }
}
