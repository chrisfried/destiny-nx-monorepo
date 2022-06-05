import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AgGridModule } from 'ag-grid-angular';

import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { PlayerComponent } from './player/player.component';
import { NgxCsvParserModule } from 'ngx-csv-parser';

import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [AppComponent, PlayerComponent],
  imports: [
    BrowserModule,
    AgGridModule.withComponents([]),
    BrowserAnimationsModule,
    NgxCsvParserModule,
    MatButtonModule,
    MatRadioModule,
    MatCheckboxModule,
    MatInputModule,
    MatIconModule,
    FormsModule,
    ClipboardModule,
    HttpClientModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
