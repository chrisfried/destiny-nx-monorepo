import { Component, Input, } from '@angular/core';
import { DestinyPlayer, PlayerService } from './player.service';

@Component({
  selector: 'destiny-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent {
  @Input() player: DestinyPlayer = {} as DestinyPlayer;
  @Input() index = 0

  fileName = ''

  constructor(private playerService: PlayerService) { }


  public changeListener(event: Event) {
    const files = (event.target as HTMLInputElement).files
    if (files && files.length > 0) {
      const file = files.item(0);
      if (file) {
        this.playerService.importWeapons(this.index, file)
        this.fileName = file.name
      }
    }
  }

  removePlayer() {
    this.playerService.removePlayer(this.index)
  }
}
