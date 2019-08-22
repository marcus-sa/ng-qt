import { NgModule } from '@angular/core';

import { ImageModule } from '@ng-cute/core/image';

export const COMPONENTS = [
  ImageModule
];

@NgModule({
  imports: COMPONENTS,
  exports: COMPONENTS,
})
export class CuteModule {}