import {
  ChangeDetectorRef,
  NgZone,
  OnDestroy,
  Pipe,
  PipeTransform,
} from '@angular/core';
import { Subscription, fromEvent, interval } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

@Pipe({
  name: 'timeAgo',
  pure: false,
  standalone: true,
})
export class TimeAgoPipe implements PipeTransform, OnDestroy {
  private timer!: Subscription;

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  transform(value: any, ...args: any[]): any {
    this.removeTimer();

    const d = new Date(value);
    const now = new Date();
    const seconds = Math.round(Math.abs((now.getTime() - d.getTime()) / 1000));
    const timeToUpdate = this.getSecondsUntilUpdate(seconds) * 1000;

    this.timer = this.ngZone.runOutsideAngular(() => {
      return fromEvent(window, 'focus')
        .pipe(
          startWith(0),
          switchMap(() => interval(timeToUpdate))
        )
        .subscribe(() => {
          this.ngZone.run(() => this.changeDetectorRef.markForCheck());
        });
    });

    const minutes = Math.round(Math.abs(seconds / 60));
    if (seconds < 60) {
      return seconds + ' seconds ago';
    }
    if (minutes < 2) {
      return 'a minute ago';
    }
    if (minutes < 60) {
      return minutes + ' minutes ago';
    }
    return 'over an hour ago';
  }

  ngOnDestroy(): void {
    this.removeTimer();
  }

  private removeTimer() {
    if (this.timer) {
      this.timer.unsubscribe();
    }
  }

  private getSecondsUntilUpdate(seconds: number) {
    const min = 60;
    const hr = min * 60;
    const day = hr * 24;

    if (seconds < min) {
      // less than 1 min, update every 2 secs
      return 2;
    } else if (seconds < hr) {
      // less than an hour, update every 30 secs
      return 30;
    } else if (seconds < day) {
      // less than a day, update every 5 mins
      return 300;
    } else {
      // update every hour
      return 3600;
    }
  }
}
