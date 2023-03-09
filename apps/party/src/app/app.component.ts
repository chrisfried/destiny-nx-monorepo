import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
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
          const index = Math.floor(Math.random() * source.size);
          items.push(`(${Array.from(source)[index]} is:exotic)`);
          exoticAvailable = 'exclude';
        } else if (exoticAvailable === 'include') {
          const source = new Set([
            ...this.intersection[slot][this.randomizationType],
            ...this.intersection[slot].exoticTypeSet,
          ]);
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
          if (index + 1 > nonExoticSize) {
            exoticAvailable = 'exclude';
          }
        } else {
          const source = this.intersection[slot][this.randomizationType];
          const index = Math.floor(Math.random() * source.size);
          items.push(`(${Array.from(source)[index]})`);
        }
      }
    });
    this.searchText = `(${items.join(' or ')}) is:weapon${
      this.minPower ? ` power:>=${this.minPower}` : ``
    }`;
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
}
