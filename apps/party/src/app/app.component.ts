import { Component } from '@angular/core';
import { PlayerService } from './player/player.service';
import { Clipboard } from '@angular/cdk/clipboard'

@Component({
  selector: 'destiny-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {

  players
  randomizationType: 'weaponSet' | 'archetypeSet' | 'typeSet' = 'weaponSet'
  exotics = false
  intersection
  searchText = ''

  constructor(private playerService: PlayerService, private clipboard: Clipboard) {
    this.players = this.playerService.players
    this.intersection = this.playerService.combinedSets.intersection
  }

  addPlayer() {
    this.playerService.addPlayer()
  }

  randomize() {
    console.log(this.randomizationType, this.exotics, this.intersection)
    const slots: Array<'kineticSlot' | 'energySlot' | 'powerSlot'> = ['kineticSlot', 'energySlot', 'powerSlot']
    slots.sort(() => Math.random() - 0.5)
    let exoticAvailable = this.exotics
    const items: string[] = []
    slots.forEach(slot => {
      if (this.randomizationType === 'typeSet') {
        const source = exoticAvailable ? new Set([...this.intersection[slot][this.randomizationType], ...this.intersection[slot].exoticTypeSet]) : this.intersection[slot][this.randomizationType]
        const index = Math.floor(Math.random() * source.size)
        items.push(`(${Array.from(source)[index]})`)
      } else {
        let source = this.intersection[slot][this.randomizationType]
        let index = Math.floor(Math.random() * source.size + (exoticAvailable ? 1 : 0))
        if (index === source.size) {
          exoticAvailable = false
          source = this.intersection[slot].exoticSet
          index = Math.floor(Math.random() * source.size)
        }
        items.push(`(${Array.from(source)[index]})`)
      }
    })
    this.clipboard.copy(items.join(' or '))
  }
}
