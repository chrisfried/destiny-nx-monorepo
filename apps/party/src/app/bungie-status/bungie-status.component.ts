import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { GlobalAlert, getGlobalAlerts } from 'bungie-api-ts/core';
import { BehaviorSubject, Subscription, from, lastValueFrom } from 'rxjs';

@Component({
  selector: 'destiny-bungie-status',
  templateUrl: './bungie-status.component.html',
  styleUrls: ['./bungie-status.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule],
})
export class BungieStatusComponent implements OnInit {
  public bungieSub?: Subscription;
  public bungieStatus?: BehaviorSubject<GlobalAlert[]>;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.bungieStatus = new BehaviorSubject([] as GlobalAlert[]);
    from(
      getGlobalAlerts(
        (config) =>
          lastValueFrom(
            this.http.request(config.method, config.url, {
              params: config.params,
              body: config.body,
            })
          ),
        {}
      )
    ).subscribe((res) => {
      this.bungieStatus?.next(res.Response);
    });
  }
}
