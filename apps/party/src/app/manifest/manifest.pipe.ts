import { Pipe, PipeTransform } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ManifestService } from './manifest.service';

@Pipe({
  name: 'manifest',
})
export class ManifestPipe implements PipeTransform {
  constructor(private manifestService: ManifestService) {}

  transform(hash: number, type: string): Observable<string> {
    return this.manifestService.manifestState$.pipe(
      map((state) => {
        if (state === 'ready') {
          switch (type) {
            case 'inventoryItem':
              return (
                this.manifestService.defs.InventoryItem?.get(hash)
                  ?.displayProperties.name ?? ''
              );
            default:
              return '';
          }
        }
        return '';
      })
    );
  }
}
