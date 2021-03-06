import { Injectable } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { take, map, tap, delay, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

import { Place } from './places.model';
import { AuthService } from '../auth/auth.service';
import { PlaceLocation } from './location.model';

// [
//   new Place(
//     'p1',
//     'Mansión de Chisinche',
//     'In the heart of Chalupas..!',
//     'https://i.ytimg.com/vi/S9kkLOmuDgs/hqdefault.jpg',
//     250.36,
//     new Date('2019-01-01'),
//     new Date('2019-12-31'),
//     'abc'
//     ),
//   new Place(
//     'p2',
//     'L\'Mansión de Ozogoche',
//     'In the heart of Culinche..!',
//     'https://megaricos.com/wp-content/uploads/2018/01/casa_venta_Miami_Beach_Florida_12.jpg',
//     299.99,
//     new Date('2019-01-01'),
//     new Date('2019-12-31'),
//     'abc'
//     ),
//   new Place(
//     'p3',
//     'The Foggy Palace',
//     'Not your average city trip!',
//     'https://i.pinimg.com/originals/9c/88/44/9c8844b217bdb6c17db14f51ad2e51a5.jpg',
//     189.99,
//     new Date('2019-01-01'),
//     new Date('2019-12-31'),
//     'abc'
//     )
// ]

interface PlaceData {
  availableFrom: string;
  availableTo: string;
  description: string;
  imageUrl: string;
  price: number;
  title: string;
  userId: string;
  location: PlaceLocation;
}

@Injectable({
  providedIn: 'root'
})
export class PlacesService {
  // tslint:disable-next-line: variable-name
  private _places = new BehaviorSubject<Place[]>([]);
  constructor(
    private authService: AuthService,
    private httpClient: HttpClient) {
    }

  get places() {
    return this._places.asObservable();
  }

  fetchPlaces() {
    return this.authService.token.pipe(take(1), switchMap(tok => {
      return this.httpClient
      .get<{[key: string]: PlaceData}>(`https://ionic-booking-api.firebaseio.com/offered-places.json?auth=${tok}`);

    }),
    map(resData => {
        const places = [];
        for (const key in resData) {
          if (resData.hasOwnProperty(key)) {
            places.push(new Place(key, resData[key].title, resData[key].description, resData[key].imageUrl,
              resData[key].price, new Date(resData[key].availableFrom), new Date(resData[key].availableTo),
              resData[key].userId, resData[key].location ));
          }
        }
        return places;
      }),
      tap(pl => {
        this._places.next(pl);
      })
    );
  }

  getPlace(id: string) {
    return this.authService.token.pipe(take(1), switchMap(tok => {
      return this.httpClient
      .get<PlaceData>(`https://ionic-booking-api.firebaseio.com/offered-places/${id}.json?auth=${tok}`);
    }),
    map(resData => {
      return new Place(id, resData.title, resData.description, resData.imageUrl, resData.price,
        new Date(resData.availableFrom), new Date(resData.availableTo), resData.userId, resData.location );
    }));
  }

  addPlace(title: string, description: string, price: number, dateFrom: Date, dateTo: Date, loc: PlaceLocation, imageUrl: string) {
    let generatedId: string;
    let fetchedUserId: string;
    let newPlace: Place;
    return this.authService.userId.pipe(
      take(1),
      switchMap(us => {
        fetchedUserId = us;
        return this.authService.token;
      }),
      take(1),
      switchMap(tok => {
      if (!fetchedUserId) {
        throw new Error('Found no user..!');
      }
      newPlace = new Place(
        Math.random().toString(),
        title,
        description,
        imageUrl,
        price,
        dateFrom,
        dateTo,
        fetchedUserId,
        loc
      );
      return this.httpClient.post<{name: string}>(`https://ionic-booking-api.firebaseio.com/offered-places.json?auth=${tok}`,
        { ...newPlace, id: null });
    }),
      switchMap(resData => {
        generatedId = resData.name;
        return this.places;
      }),
      take(1),
      tap(pl => {
        newPlace.id = generatedId;
        this._places.next(pl.concat(newPlace));
      })
    );
  }

  onUpdatePlace(placeId: string, title: string, description: string) {
    let updatedPlaces: Place[];
    let fetchedToken: string;
    return this.authService.token.pipe(
      take(1),
      switchMap(tok => {
        fetchedToken = tok;
        return this.places;
      }),
    take(1),
    switchMap(pl => {
      if (!pl || pl.length <= 0) {
        return this.fetchPlaces();
      } else {
        return of(pl);
      }
    }),
    switchMap(pl => {
      const updatedPlaceIndex = pl.findIndex(p => p.id === placeId);
      updatedPlaces = [...pl];
      const oldPlace = updatedPlaces[updatedPlaceIndex];
      updatedPlaces[updatedPlaceIndex] = new Place(oldPlace.id, title, description,
        oldPlace.imageUrl, oldPlace.price, oldPlace.availableFrom, oldPlace.availableTo,
        oldPlace.userId, oldPlace.location);
      return this.httpClient.put(`https://ionic-booking-api.firebaseio.com/offered-places/${placeId}.json?auth=${fetchedToken}`,
        { ...updatedPlaces[updatedPlaceIndex], id: null }
      );
    }),
    tap(() => {
      this._places.next(updatedPlaces);
    }));
  }

  uploadImage(image: File) {
    const uploadData = new FormData();
    uploadData.append('image', image);
    return this.authService.token.pipe(take(1), switchMap(tok => {
      return this.httpClient.post<{imageUrl: string, imagePath: string}>(
        'https://us-central1-ionic-booking-api.cloudfunctions.net/storeImage',
        uploadData, {headers: {Authorization: 'Bearer ' + tok }}
      );
    }));
  }
}
