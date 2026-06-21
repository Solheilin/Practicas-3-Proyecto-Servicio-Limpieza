import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListaSolicitudes } from './lista-solicitudes';

describe('ListaSolicitudes', () => {
  let component: ListaSolicitudes;
  let fixture: ComponentFixture<ListaSolicitudes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaSolicitudes],
    }).compileComponents();

    fixture = TestBed.createComponent(ListaSolicitudes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
