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
import { MatSelectModule } from '@angular/material/select';
import { getCollectibleDef, getInventoryItemDef } from '@d2api/manifest';
import { getEquipmentSlotDef } from '@d2api/manifest-web';
import {
  DestinyAmmunitionType,
  DestinyInventoryItemDefinition,
  DestinyManifestLanguage,
  destinyManifestLanguages,
} from 'bungie-api-ts/destiny2';
import {
  UserMembershipData,
  getMembershipDataForCurrentUser,
} from 'bungie-api-ts/user';
// @ts-expect-error: No types available
import P2PCF from 'p2pcf';
import {
  EMPTY,
  distinctUntilChanged,
  from,
  lastValueFrom,
  map,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { environment } from '../environments/environment';
import { BungieAuthModule } from './bungie-auth/bungie-auth.module';
import { BungieAuthService } from './bungie-auth/bungie-auth.service';
import { BungieStatusComponent } from './bungie-status/bungie-status.component';
import { ManifestService } from './manifest/manifest.service';
import { P2PCFService } from './p2pcf.service';
import { PlayerComponent } from './player/player.component';
import { PlayerService } from './player/player.service';
import { TimeAgoPipe } from './timeAgo.pipe';
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
    CommonModule,
    ClipboardModule,
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
    MatSelectModule,
    PlayerComponent,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    WebringComponent,
    WebringSheetComponent,
    BungieAuthModule,
    BungieStatusComponent,
    TimeAgoPipe,
  ],
})
export class AppComponent {
  // randomizationType: 'weaponSet' | 'archetypeSet' | 'typeSet' = 'weaponSet';
  exotics: 'exclude' | 'include' | 'required' =
    (localStorage.getItem('exotics') as 'exclude' | 'include' | 'required') ??
    'include';
  intersection;
  searchText = '';
  // minPower = 0;
  discordWebhookUrl = localStorage.getItem('discordWebhookUrl') ?? '';
  discordThreadId = localStorage.getItem('discordThreadId') ?? '';
  discordMessageId = '';
  discordCleanUp = JSON.parse(
    localStorage.getItem('discordCleanUp') ?? 'false'
  );
  manifestState = this.manifestService.state$;
  nameInput = '';
  roomCode = localStorage.getItem('roomCode') ?? '';
  collectionExotics: boolean = JSON.parse(
    localStorage.getItem('collectionExotics') ?? 'false'
  );
  collectionNonExotics: boolean = JSON.parse(
    localStorage.getItem('collectionNonExotics') ?? 'false'
  );
  requiresPull = false;
  requirePrimary: boolean = JSON.parse(
    localStorage.getItem('requirePrimary') ?? 'false'
  );
  requireSpecial: boolean = JSON.parse(
    localStorage.getItem('requireSpecial') ?? 'false'
  );
  weaponCount = 0;
  exoticCount = 0;
  nonExoticCount = 0;
  joinedRoom = !!localStorage.getItem('roomCode');
  currentLoadout: DestinyInventoryItemDefinition[] = [];
  lastLoadout = new Date();
  showCode = false;

  localMembership?: UserMembershipData;

  destinyManifestLanguages = destinyManifestLanguages;
  language$ = this.manifestService.language$;

  hideAwait = false;

  constructor(
    public playerService: PlayerService,
    private manifestService: ManifestService,
    private clipboard: Clipboard,
    private http: HttpClient,
    public bungieAuth: BungieAuthService,
    private p2pcfService: P2PCFService
  ) {
    this.bungieAuth.hasValidAccessToken$
      .pipe(
        switchMap((hasToken) => {
          if (hasToken) {
            return from(
              getMembershipDataForCurrentUser((config) =>
                lastValueFrom(
                  this.http.request(config.method, config.url, {
                    params: config.params,
                    body: config.body,
                  })
                )
              )
            );
          } else {
            return EMPTY;
          }
        }),
        map((res) => {
          this.localMembership = res.Response;
          this.playerService.addLocalPlayer(this.localMembership);

          if (this.roomCode) {
            this.joinRoom();
          }
        })
      )
      .subscribe();
    this.intersection = this.playerService.combinedSets.intersection;
    // this.playerService.minPower.subscribe((value) => (this.minPower = value));
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

    this.playerService.localPlayer$
      .pipe(
        map((player) => {
          this.p2pcfService.p2pcf?.broadcast(
            new TextEncoder().encode(
              JSON.stringify({ type: 'player', body: player })
            )
          );
        })
      )
      .subscribe();

    this.manifestService.state$.subscribe((state) => {
      if (state === 'ready' && this.currentLoadout.length) {
        this.currentLoadout = this.currentLoadout.map(
          (item) => getInventoryItemDef(item.hash) ?? item
        );
        this.searchText = this.generateSearchText(this.currentLoadout);
      }
    });
  }

  setLanguage(language: DestinyManifestLanguage) {
    this.manifestService.language$.next(language);
  }

  storeValue(store: string, value: any) {
    localStorage.setItem(store, value);
    this.updateCounts();
  }

  login(): void {
    this.bungieAuth.login();
  }

  logout(): void {
    this.bungieAuth.logout();
  }

  joinRoom() {
    this.currentLoadout = [];
    this.searchText = '';
    this.roomCode = this.roomCode.toUpperCase();
    localStorage.setItem('roomCode', this.roomCode);
    this.joinedRoom = true;

    this.startP2pcf();
  }

  newRoom() {
    this.joinedRoom = true;

    let code = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const charactersLength = characters.length;
    for (let i = 0; i < 4; i++) {
      code += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    this.roomCode = code;
    localStorage.setItem('roomCode', this.roomCode);
    this.copyCode();

    this.startP2pcf();
  }

  startP2pcf() {
    this.p2pcfService.p2pcf = new P2PCF(
      this.localMembership?.primaryMembershipId ??
        this.localMembership?.destinyMemberships[0].membershipId,
      `d2srl-${this.roomCode}`,
      {
        workerUrl: 'https://p2pcf.chrisfried.workers.dev/',
        turnIceServers: [
          {
            urls: 'stun:stun.relay.metered.ca:80',
          },
          {
            urls: 'turn:standard.relay.metered.ca:80',
            username: environment.turn.username,
            credential: environment.turn.credential,
          },
          {
            urls: 'turn:standard.relay.metered.ca:80?transport=tcp',
            username: environment.turn.username,
            credential: environment.turn.credential,
          },
          {
            urls: 'turn:standard.relay.metered.ca:443',
            username: environment.turn.username,
            credential: environment.turn.credential,
          },
          {
            urls: 'turns:standard.relay.metered.ca:443?transport=tcp',
            username: environment.turn.username,
            credential: environment.turn.credential,
          },
        ],
      }
    );

    this.p2pcfService.p2pcf.start();

    this.p2pcfService.p2pcf.on('peerconnect', (peer: any) => {
      // New peer connected

      // Peer is an instance of simple-peer (https://github.com/feross/simple-peer)
      //
      // The peer has two custom fields:
      // - id (a per session unique id)
      // - client_id (which was passed to their P2PCF constructor)
      this.playerService.localPlayer$
        .pipe(
          take(1),
          map((player) => {
            this.p2pcfService.p2pcf?.send(
              peer,
              new TextEncoder().encode(
                JSON.stringify({ type: 'player', body: player })
              )
            );
          })
        )
        .subscribe();
      this.playerService.manualPlayers$
        .pipe(
          take(1),
          map((players) => {
            players
              .filter((p) => p.status === 'ready')
              .forEach((player) => {
                this.p2pcfService.p2pcf?.send(
                  peer,
                  new TextEncoder().encode(
                    JSON.stringify({ type: 'manualPlayer', body: player })
                  )
                );
              });
          })
        )
        .subscribe();
      if (this.currentLoadout.length > 0) {
        this.p2pcfService.p2pcf?.send(
          peer,
          new TextEncoder().encode(
            JSON.stringify({
              type: 'loadout',
              body: this.currentLoadout,
              timestamp: this.lastLoadout.toISOString(),
            })
          )
        );
      }
    });

    this.p2pcfService.p2pcf.on('peerclose', (peer: any) => {
      // Peer has disconnected
      this.playerService.removeRemotePlayer(peer.client_id);
    });

    this.p2pcfService.p2pcf.on('msg', (peer: any, data: any) => {
      const msg = JSON.parse(new TextDecoder('utf-8').decode(data));
      if (msg.type === 'loadout') {
        this.currentLoadout = msg.body.map(
          (i: DestinyInventoryItemDefinition) => getInventoryItemDef(i.hash)
        );
        this.searchText = this.generateSearchText(this.currentLoadout);
        this.lastLoadout = new Date(msg.timestamp);
      }
      if (msg.type === 'player') {
        this.playerService.addRemotePlayer(msg.body);
      }
      if (msg.type === 'manualPlayer') {
        this.playerService.addManualPlayer(msg.body);
      }
      if (msg.type === 'removeManualPlayer') {
        this.playerService.removeManualPlayer(msg.body);
      }
    });
  }

  generateSearchText(loadout: DestinyInventoryItemDefinition[]) {
    const names = Array.from(
      new Set(loadout.map((item) => item.displayProperties.name))
    );

    return `(${names
      .map((name) => `name:"${name}"`)
      .join(' OR ')}) AND is:weapon`;
  }

  addManualPlayer() {
    this.playerService.addManualPlayer(this.nameInput);
    this.nameInput = '';
  }

  leaveRoom() {
    localStorage.removeItem('roomCode');
    location.reload();
  }

  changeMinPower(value: any) {
    if (!isNaN(parseInt(value.target.value))) {
      this.playerService.minPower.next(parseInt(value.target.value));
    } else {
      this.playerService.minPower.next(0);
    }
  }

  randomize() {
    this.searchText = '';
    this.currentLoadout = [];
    this.requiresPull = false;

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
            this.currentLoadout.push(item);
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
        const splitName = item.displayProperties.name
          .split(' (')[0]
          .split('_v1')[0];

        let hashes = [item.hash];

        if (splitName && this.manifestService.nonExoticNameLookup[splitName]) {
          hashes = [
            ...hashes,
            ...this.manifestService.nonExoticNameLookup[splitName],
          ];
        }

        if (splitName && this.manifestService.exoticNameLookup[splitName]) {
          hashes = [
            ...hashes,
            ...this.manifestService.exoticNameLookup[splitName],
          ];
        }

        hashes = Array.from(new Set(hashes));

        hashes.forEach((hash) => {
          const item = getInventoryItemDef(hash);
          if (item) {
            this.currentLoadout.push(item);
          }
        });

        if (item.equippingBlock?.ammoType === DestinyAmmunitionType.Primary) {
          requirePrimary = false;
        }
        if (item.equippingBlock?.ammoType === DestinyAmmunitionType.Special) {
          requireSpecial = false;
        }
      }
    });

    this.searchText = this.generateSearchText(this.currentLoadout);

    this.copySearch();
    if (this.discordWebhookUrl) {
      if (this.discordMessageId && this.discordCleanUp) {
        this.http
          .delete(`${this.discordWebhookUrl}/messages/${this.discordMessageId}`)
          .subscribe(() => {
            this.discordMessageId = '';
          });
      }
      const url = this.discordThreadId
        ? `${this.discordWebhookUrl}?wait=true&thread_id=${this.discordThreadId}`
        : `${this.discordWebhookUrl}?wait=true`;
      this.http
        .post(url, {
          content: `\`\`\`${this.searchText}\`\`\``,
        })
        .subscribe((res) => {
          this.discordMessageId = (res as any).id;
        });
    }

    this.lastLoadout = new Date();

    this.p2pcfService.p2pcf?.broadcast(
      new TextEncoder().encode(
        JSON.stringify({
          type: 'loadout',
          body: this.currentLoadout,
          timestamp: this.lastLoadout.toISOString(),
        })
      )
    );
  }

  copyCode() {
    this.clipboard.copy(this.roomCode);
  }

  copySearch() {
    this.clipboard.copy(this.searchText);
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
