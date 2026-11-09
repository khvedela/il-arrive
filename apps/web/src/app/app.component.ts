import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IaToastContainerComponent } from '@il-arrive/ui';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, IaToastContainerComponent],
  template: `
    <router-outlet />
    <ia-toast-container />
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }
  `],
})
export class AppComponent {}
