import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BungieOAuthStorage } from './bungie-auth.storage';

@Injectable({
  providedIn: 'root',
})
export class BungieAuthInterceptor implements HttpInterceptor {
  constructor(private authStorage: BungieOAuthStorage) {}

  private checkUrl(url: string): boolean {
    const allowedUrls = ['https://www.bungie.net', 'https://stats.bungie.net'];
    const found = allowedUrls.find((u) => url.startsWith(u));
    return !!found;
  }

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    let url = req.url.toLowerCase();

    if (!this.checkUrl(url)) {
      return next.handle(req);
    }
    let headers = req.headers;
    if (url.indexOf('common/destiny2_content') > 0) {
    } else {
      headers = headers.set('X-API-Key', environment.bungie.apiKey);
      if (
        url === 'https://www.bungie.net/platform/app/oauth/token/' ||
        url.indexOf('getmembershipsbyid') > 0
      ) {
      } else {
        if (this.authStorage.getItem('access_token')) {
          headers = headers.set(
            'Authorization',
            `Bearer ${this.authStorage.getItem('access_token')}`
          );
        }
      }
      if (url.indexOf('/Stats/Activities/') > -1) {
        url = url.replace('www.bungie', 'stats.bungie');
      }
    }

    req = req.clone({ headers });

    return next.handle(req);
  }
}
