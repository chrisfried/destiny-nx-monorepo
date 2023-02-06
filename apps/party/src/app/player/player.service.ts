import { Injectable } from '@angular/core';
import { Papa, ParseResult } from 'ngx-papaparse';
import { BehaviorSubject, Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  players: DestinyPlayer[] = [];
  combinedSets = {
    union: {
      kineticSlot: {
        exoticSet: new Set(),
        exoticTypeSet: new Set(),
        weaponSet: new Set(),
        typeSet: new Set(),
        archetypeSet: new Set(),
      },
      energySlot: {
        exoticSet: new Set(),
        exoticTypeSet: new Set(),
        weaponSet: new Set(),
        typeSet: new Set(),
        archetypeSet: new Set(),
      },
      powerSlot: {
        exoticSet: new Set(),
        exoticTypeSet: new Set(),
        weaponSet: new Set(),
        typeSet: new Set(),
        archetypeSet: new Set(),
      },
    },
    intersection: {
      kineticSlot: {
        exoticSet: new Set(),
        exoticTypeSet: new Set(),
        weaponSet: new Set(),
        typeSet: new Set(),
        archetypeSet: new Set(),
      },
      energySlot: {
        exoticSet: new Set(),
        exoticTypeSet: new Set(),
        weaponSet: new Set(),
        typeSet: new Set(),
        archetypeSet: new Set(),
      },
      powerSlot: {
        exoticSet: new Set(),
        exoticTypeSet: new Set(),
        weaponSet: new Set(),
        typeSet: new Set(),
        archetypeSet: new Set(),
      },
    },
  };
  classWeaponSet = new Set([
    '1180270694',
    '2782325302',
    '1180270692',
    '2782325300',
    '1180270693',
    '2782325301',
    '569799273',
    '569799275',
    '569799274',
  ]);
  minPower = new BehaviorSubject(0);

  constructor(private papa: Papa) {
    this.addPlayer();
  }

  addPlayer() {
    this.players.push({
      name: '',
      kineticSlot: {
        exoticSet: new Set(),
        exoticTypeSet: new Set(),
        weaponSet: new Set(),
        typeSet: new Set(),
        archetypeSet: new Set(),
      },
      energySlot: {
        exoticSet: new Set(),
        exoticTypeSet: new Set(),
        weaponSet: new Set(),
        typeSet: new Set(),
        archetypeSet: new Set(),
      },
      powerSlot: {
        exoticSet: new Set(),
        exoticTypeSet: new Set(),
        weaponSet: new Set(),
        typeSet: new Set(),
        archetypeSet: new Set(),
      },
    });
  }

  removePlayer(index: number) {
    this.players[index].subscription?.unsubscribe();
    this.players.splice(index, 1);
    this.updateCombinedSets();
    if (this.players.length < 1) {
      this.addPlayer();
    }
  }

  importWeapons(playerIndex: number, file: File) {
    const player = this.players[playerIndex];
    player.subscription?.unsubscribe();

    this.papa.parse(file, {
      header: true,
      complete: (result: ParseResult<WeaponDefinition[]>) => {
        player.subscription = this.minPower.subscribe(
          (minPower) => {
            if (!Array.isArray(result?.data)) {
              throw result;
            } else {
              let data = result.data.map((r) => ({
                ...r,
                Name: r.Name?.split(' (')[0].split('v1.')[0],
              }));

              player.weapons = [];
              player.kineticSlot = {
                exoticSet: new Set(),
                exoticTypeSet: new Set(),
                weaponSet: new Set(),
                typeSet: new Set(),
                archetypeSet: new Set(),
              };
              player.energySlot = {
                exoticSet: new Set(),
                exoticTypeSet: new Set(),
                weaponSet: new Set(),
                typeSet: new Set(),
                archetypeSet: new Set(),
              };
              player.powerSlot = {
                exoticSet: new Set(),
                exoticTypeSet: new Set(),
                weaponSet: new Set(),
                typeSet: new Set(),
                archetypeSet: new Set(),
              };
              data = data.filter(
                (weapon) => parseInt(weapon.Power) >= minPower
              );

              data.forEach((row) => {
                let i = 0;
                while (i < 15 && !row.Archetype) {
                  const perk = `Perks ${i}` as keyof WeaponDefinition;
                  if (row[perk]) {
                    row.Archetype = row[perk].replace(/\*/g, '');
                  }
                  i++;
                }
              });
              player.weapons = data as WeaponDefinition[];
              player.kineticSlot.exoticSet = new Set(
                player.weapons
                  .filter(
                    (w) => w.Tier === 'Exotic' && w.Category === 'KineticSlot'
                  )
                  .map((w) => `name:"${w.Name}"`)
              );
              player.kineticSlot.exoticTypeSet = new Set(
                player.weapons
                  .filter(
                    (w) => w.Tier === 'Exotic' && w.Category === 'KineticSlot'
                  )
                  .map((w) => `is:${this.dimType(w.Type)} is:kineticslot`)
              );
              player.kineticSlot.weaponSet = new Set(
                player.weapons
                  .filter(
                    (w) =>
                      w.Tier !== 'Exotic' &&
                      w.Category === 'KineticSlot' &&
                      !this.classWeaponSet.has(w.Hash)
                  )
                  .map((w) => {
                    return `name:"${w.Name}"`;
                  })
              );
              player.kineticSlot.typeSet = new Set(
                player.weapons
                  .filter(
                    (w) => w.Tier !== 'Exotic' && w.Category === 'KineticSlot'
                  )
                  .map((w) => `is:${this.dimType(w.Type)} is:kineticslot`)
              );
              player.kineticSlot.archetypeSet = new Set(
                player.weapons
                  .filter(
                    (w) => w.Tier !== 'Exotic' && w.Category === 'KineticSlot'
                  )
                  .map(
                    (w) =>
                      `perk:"${w.Archetype}" is:${this.dimType(
                        w.Type
                      )} is:kineticslot`
                  )
              );
              player.energySlot.exoticSet = new Set(
                player.weapons
                  .filter((w) => w.Tier === 'Exotic' && w.Category === 'Energy')
                  .map((w) => `name:"${w.Name}"`)
              );
              player.energySlot.exoticTypeSet = new Set(
                player.weapons
                  .filter((w) => w.Tier === 'Exotic' && w.Category === 'Energy')
                  .map((w) => `is:${this.dimType(w.Type)} is:energy`)
              );
              player.energySlot.weaponSet = new Set(
                player.weapons
                  .filter(
                    (w) =>
                      w.Tier !== 'Exotic' &&
                      w.Category === 'Energy' &&
                      !this.classWeaponSet.has(w.Hash)
                  )
                  .map((w) => {
                    return `name:"${w.Name}"`;
                  })
              );
              player.energySlot.typeSet = new Set(
                player.weapons
                  .filter((w) => w.Tier !== 'Exotic' && w.Category === 'Energy')
                  .map((w) => `is:${this.dimType(w.Type)} is:energy`)
              );
              player.energySlot.archetypeSet = new Set(
                player.weapons
                  .filter((w) => w.Tier !== 'Exotic' && w.Category === 'Energy')
                  .map(
                    (w) =>
                      `perk:"${w.Archetype}" is:${this.dimType(
                        w.Type
                      )} is:energy`
                  )
              );
              player.powerSlot.exoticSet = new Set(
                player.weapons
                  .filter((w) => w.Tier === 'Exotic' && w.Category === 'Power')
                  .map((w) => `name:"${w.Name}"`)
              );
              player.powerSlot.exoticTypeSet = new Set(
                player.weapons
                  .filter((w) => w.Tier === 'Exotic' && w.Category === 'Power')
                  .map((w) => `is:${this.dimType(w.Type)} is:heavy`)
              );
              player.powerSlot.weaponSet = new Set(
                player.weapons
                  .filter(
                    (w) =>
                      w.Tier !== 'Exotic' &&
                      w.Category === 'Power' &&
                      !this.classWeaponSet.has(w.Hash)
                  )
                  .map((w) => {
                    return `name:"${w.Name}"`;
                  })
              );
              player.powerSlot.typeSet = new Set(
                player.weapons
                  .filter((w) => w.Tier !== 'Exotic' && w.Category === 'Power')
                  .map((w) => `is:${this.dimType(w.Type)} is:heavy`)
              );
              player.powerSlot.archetypeSet = new Set(
                player.weapons
                  .filter((w) => w.Tier !== 'Exotic' && w.Category === 'Power')
                  .map(
                    (w) =>
                      `perk:"${w.Archetype}" is:${this.dimType(
                        w.Type
                      )} is:heavy`
                  )
              );
              player.lastImport = new Date();

              this.updateCombinedSets();
            }

            if (!this.players.find((p) => !p.lastImport)) {
              this.addPlayer();
            }
          },
          (error) => {
            this.updateCombinedSets();
            console.error('Error', error);
          }
        );
      },
    });
  }

  dimType(type: string) {
    switch (type) {
      case 'Submachine Gun':
        return 'smg';
      case 'Combat Bow':
        return 'bow';
      default:
        return type.replace(/\s/g, '').toLowerCase();
    }
  }

  updateCombinedSets() {
    this.combinedSets.union.kineticSlot.exoticSet = new Set();
    this.combinedSets.union.kineticSlot.exoticTypeSet = new Set();
    this.combinedSets.union.kineticSlot.weaponSet = new Set();
    this.combinedSets.union.kineticSlot.typeSet = new Set();
    this.combinedSets.union.kineticSlot.archetypeSet = new Set();
    this.combinedSets.union.energySlot.exoticSet = new Set();
    this.combinedSets.union.energySlot.exoticTypeSet = new Set();
    this.combinedSets.union.energySlot.weaponSet = new Set();
    this.combinedSets.union.energySlot.typeSet = new Set();
    this.combinedSets.union.energySlot.archetypeSet = new Set();
    this.combinedSets.union.powerSlot.exoticSet = new Set();
    this.combinedSets.union.powerSlot.exoticTypeSet = new Set();
    this.combinedSets.union.powerSlot.weaponSet = new Set();
    this.combinedSets.union.powerSlot.typeSet = new Set();
    this.combinedSets.union.powerSlot.archetypeSet = new Set();

    this.players
      .filter((p) => p.weapons)
      .forEach((player) => {
        this.combinedSets.union.kineticSlot.exoticSet = new Set([
          ...this.combinedSets.union.kineticSlot.exoticSet,
          ...player.kineticSlot.exoticSet,
        ]);
        this.combinedSets.union.kineticSlot.exoticTypeSet = new Set([
          ...this.combinedSets.union.kineticSlot.exoticTypeSet,
          ...player.kineticSlot.exoticTypeSet,
        ]);
        this.combinedSets.union.kineticSlot.weaponSet = new Set([
          ...this.combinedSets.union.kineticSlot.weaponSet,
          ...player.kineticSlot.weaponSet,
        ]);
        this.combinedSets.union.kineticSlot.typeSet = new Set([
          ...this.combinedSets.union.kineticSlot.typeSet,
          ...player.kineticSlot.typeSet,
        ]);
        this.combinedSets.union.kineticSlot.archetypeSet = new Set([
          ...this.combinedSets.union.kineticSlot.archetypeSet,
          ...player.kineticSlot.archetypeSet,
        ]);
        this.combinedSets.union.energySlot.exoticSet = new Set([
          ...this.combinedSets.union.energySlot.exoticSet,
          ...player.energySlot.exoticSet,
        ]);
        this.combinedSets.union.energySlot.exoticTypeSet = new Set([
          ...this.combinedSets.union.energySlot.exoticTypeSet,
          ...player.energySlot.exoticTypeSet,
        ]);
        this.combinedSets.union.energySlot.weaponSet = new Set([
          ...this.combinedSets.union.energySlot.weaponSet,
          ...player.energySlot.weaponSet,
        ]);
        this.combinedSets.union.energySlot.typeSet = new Set([
          ...this.combinedSets.union.energySlot.typeSet,
          ...player.energySlot.typeSet,
        ]);
        this.combinedSets.union.energySlot.archetypeSet = new Set([
          ...this.combinedSets.union.energySlot.archetypeSet,
          ...player.energySlot.archetypeSet,
        ]);
        this.combinedSets.union.powerSlot.exoticSet = new Set([
          ...this.combinedSets.union.powerSlot.exoticSet,
          ...player.powerSlot.exoticSet,
        ]);
        this.combinedSets.union.powerSlot.exoticTypeSet = new Set([
          ...this.combinedSets.union.powerSlot.exoticTypeSet,
          ...player.powerSlot.exoticTypeSet,
        ]);
        this.combinedSets.union.powerSlot.weaponSet = new Set([
          ...this.combinedSets.union.powerSlot.weaponSet,
          ...player.powerSlot.weaponSet,
        ]);
        this.combinedSets.union.powerSlot.typeSet = new Set([
          ...this.combinedSets.union.powerSlot.typeSet,
          ...player.powerSlot.typeSet,
        ]);
        this.combinedSets.union.powerSlot.archetypeSet = new Set([
          ...this.combinedSets.union.powerSlot.archetypeSet,
          ...player.powerSlot.archetypeSet,
        ]);
      });

    this.combinedSets.intersection.kineticSlot.exoticSet = new Set([
      ...this.combinedSets.union.kineticSlot.exoticSet,
    ]);
    this.combinedSets.intersection.kineticSlot.exoticTypeSet = new Set([
      ...this.combinedSets.union.kineticSlot.exoticTypeSet,
    ]);
    this.combinedSets.intersection.kineticSlot.weaponSet = new Set([
      ...this.combinedSets.union.kineticSlot.weaponSet,
    ]);
    this.combinedSets.intersection.kineticSlot.typeSet = new Set([
      ...this.combinedSets.union.kineticSlot.typeSet,
    ]);
    this.combinedSets.intersection.kineticSlot.archetypeSet = new Set([
      ...this.combinedSets.union.kineticSlot.archetypeSet,
    ]);
    this.combinedSets.intersection.energySlot.exoticSet = new Set([
      ...this.combinedSets.union.energySlot.exoticSet,
    ]);
    this.combinedSets.intersection.energySlot.exoticTypeSet = new Set([
      ...this.combinedSets.union.energySlot.exoticTypeSet,
    ]);
    this.combinedSets.intersection.energySlot.weaponSet = new Set([
      ...this.combinedSets.union.energySlot.weaponSet,
    ]);
    this.combinedSets.intersection.energySlot.typeSet = new Set([
      ...this.combinedSets.union.energySlot.typeSet,
    ]);
    this.combinedSets.intersection.energySlot.archetypeSet = new Set([
      ...this.combinedSets.union.energySlot.archetypeSet,
    ]);
    this.combinedSets.intersection.powerSlot.exoticSet = new Set([
      ...this.combinedSets.union.powerSlot.exoticSet,
    ]);
    this.combinedSets.intersection.powerSlot.exoticTypeSet = new Set([
      ...this.combinedSets.union.powerSlot.exoticTypeSet,
    ]);
    this.combinedSets.intersection.powerSlot.weaponSet = new Set([
      ...this.combinedSets.union.powerSlot.weaponSet,
    ]);
    this.combinedSets.intersection.powerSlot.typeSet = new Set([
      ...this.combinedSets.union.powerSlot.typeSet,
    ]);
    this.combinedSets.intersection.powerSlot.archetypeSet = new Set([
      ...this.combinedSets.union.powerSlot.archetypeSet,
    ]);

    this.players
      .filter((p) => p.weapons)
      .forEach((player) => {
        this.combinedSets.intersection.kineticSlot.exoticSet = new Set(
          [...this.combinedSets.intersection.kineticSlot.exoticSet].filter(
            (x) => player.kineticSlot.exoticSet.has(x as string)
          )
        );
        this.combinedSets.intersection.kineticSlot.exoticTypeSet = new Set(
          [...this.combinedSets.intersection.kineticSlot.exoticTypeSet].filter(
            (x) => player.kineticSlot.exoticTypeSet.has(x as string)
          )
        );
        this.combinedSets.intersection.kineticSlot.weaponSet = new Set(
          [...this.combinedSets.intersection.kineticSlot.weaponSet].filter(
            (x) => player.kineticSlot.weaponSet.has(x as string)
          )
        );
        this.combinedSets.intersection.kineticSlot.typeSet = new Set(
          [...this.combinedSets.intersection.kineticSlot.typeSet].filter((x) =>
            player.kineticSlot.typeSet.has(x as string)
          )
        );
        this.combinedSets.intersection.kineticSlot.archetypeSet = new Set(
          [...this.combinedSets.intersection.kineticSlot.archetypeSet].filter(
            (x) => player.kineticSlot.archetypeSet.has(x as string)
          )
        );
        this.combinedSets.intersection.energySlot.exoticSet = new Set(
          [...this.combinedSets.intersection.energySlot.exoticSet].filter((x) =>
            player.energySlot.exoticSet.has(x as string)
          )
        );
        this.combinedSets.intersection.energySlot.exoticTypeSet = new Set(
          [...this.combinedSets.intersection.energySlot.exoticTypeSet].filter(
            (x) => player.energySlot.exoticTypeSet.has(x as string)
          )
        );
        this.combinedSets.intersection.energySlot.weaponSet = new Set(
          [...this.combinedSets.intersection.energySlot.weaponSet].filter((x) =>
            player.energySlot.weaponSet.has(x as string)
          )
        );
        this.combinedSets.intersection.energySlot.typeSet = new Set(
          [...this.combinedSets.intersection.energySlot.typeSet].filter((x) =>
            player.energySlot.typeSet.has(x as string)
          )
        );
        this.combinedSets.intersection.energySlot.archetypeSet = new Set(
          [...this.combinedSets.intersection.energySlot.archetypeSet].filter(
            (x) => player.energySlot.archetypeSet.has(x as string)
          )
        );
        this.combinedSets.intersection.powerSlot.exoticSet = new Set(
          [...this.combinedSets.intersection.powerSlot.exoticSet].filter((x) =>
            player.powerSlot.exoticSet.has(x as string)
          )
        );
        this.combinedSets.intersection.powerSlot.exoticTypeSet = new Set(
          [...this.combinedSets.intersection.powerSlot.exoticTypeSet].filter(
            (x) => player.powerSlot.exoticTypeSet.has(x as string)
          )
        );
        this.combinedSets.intersection.powerSlot.weaponSet = new Set(
          [...this.combinedSets.intersection.powerSlot.weaponSet].filter((x) =>
            player.powerSlot.weaponSet.has(x as string)
          )
        );
        this.combinedSets.intersection.powerSlot.typeSet = new Set(
          [...this.combinedSets.intersection.powerSlot.typeSet].filter((x) =>
            player.powerSlot.typeSet.has(x as string)
          )
        );
        this.combinedSets.intersection.powerSlot.archetypeSet = new Set(
          [...this.combinedSets.intersection.powerSlot.archetypeSet].filter(
            (x) => player.powerSlot.archetypeSet.has(x as string)
          )
        );
      });
  }
}

export type WeaponDefinition = {
  AA: string;
  Accuracy: string;
  Archetype: string;
  'Blast Radius': string;
  Category: string;
  'Charge Time': string;
  'Draw Time': string;
  Element: string;
  Equip: string;
  Equipped: string;
  Event: string;
  Hash: string;
  Id: string;
  Impact: string;
  Locked: string;
  Mag: string;
  'Masterwork Tier': string;
  'Masterwork Type': string;
  Name: string;
  Notes: string;
  Owner: string;
  'Perks 0': string;
  'Perks 1': string;
  'Perks 2': string;
  'Perks 3': string;
  'Perks 4': string;
  'Perks 5': string;
  'Perks 6': string;
  'Perks 7': string;
  'Perks 8': string;
  'Perks 9': string;
  'Perks 10': string;
  'Perks 11': string;
  'Perks 12': string;
  'Perks 13': string;
  'Perks 14': string;
  'Perks 15': string;
  Power: string;
  'Power Limit': string;
  ROF: string;
  Range: string;
  Recoil: string;
  Reload: string;
  Season: string;
  Source: string;
  Stability: string;
  Tag: string;
  Tier: string;
  Type: string;
  Velocity: string;
  Year: string;
};
export type WeaponDefinitionKeys = keyof WeaponDefinition;

export type DestinyPlayer = {
  name: string;
  weapons?: WeaponDefinition[];
  lastImport?: Date;
  kineticSlot: WeaponSets;
  energySlot: WeaponSets;
  powerSlot: WeaponSets;
  subscription?: Subscription;
};

export type WeaponSets = {
  exoticSet: Set<string>;
  exoticTypeSet: Set<string>;
  weaponSet: Set<string>;
  typeSet: Set<string>;
  archetypeSet: Set<string>;
};
