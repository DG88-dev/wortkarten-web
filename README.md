# Wortkarten Web

Magyar felületű, német és angol szókártyás alkalmazás iPadre, iPhone-ra és Macre. A natív Wortkarten 2.19 szókészlete: nyelvenként 5684 szó, változatlan azonosítókkal, szintekkel és normalizált sorszámokkal.

## Funkciók

- Szint, szófaj, témakör, német nyelvvizsga-témakör és kategória szerinti többszörös szűrés; a szófaj- és témaválasztók csak találattal rendelkező értékeket kínálnak.
- Kétfogantyús sorszámcsúszka, szinthez és elrejtéshez igazodó tartománnyal.
- Fejléc nélküli, sorszám szerint rendezett lista. Kis kijelzőn a témakör, telefonon a szófaj oszlop is elmarad a jobb olvashatóságért.
- Szótár három karaktertől, a teljes aktuális nyelvi készletben, a szűrőktől függetlenül.
- Kétirányú szókártyák, példamondatok és alakok; C: kedvenc, N: elrejtés, szóköz: fordítás, nyilak: előző/következő, Esc: beállítások, kör végén Enter: új kör.
- Der–Die–Das mód kijelölt német főnevekre; 1/2/3: válasz, hibánál újrakezdés változatlan sorrendben, Keverés: ugyanaz a szókészlet új sorrendben. 2818 egyértelmű névelős főnév; 37 névelő nélküli főnév kimarad.
- Google-bejelentkezés és fiókonként elkülönített Firestore-jelölések. A beállítások helyiek, a kedvencek/elrejtések szinkronizálódnak.

## Első közzététel Firebase Hostingra

Projekt: `wortkarten-58af7`. A Firebase Console-ban:

1. Authentication: a Google szolgáltató legyen engedélyezve.
2. Authentication → Settings → Authorized domains: legyen benne `wortkarten-58af7.web.app` és `wortkarten-58af7.firebaseapp.com`.
3. Cloud Firestore: hozz létre Standard, `(default)` azonosítójú adatbázist. A Production mode megfelelő. A régiót létrehozáskor válaszd ki.
4. Töltsd le ezt a tárolót: Code → Download ZIP, majd csomagold ki.
5. Macen futtasd a `Kozzetetel.command` fájlt. Ha a Finder nem indítja, a Terminálba írd be: `bash ` (utána szóköz), húzd be a fájlt, majd Enter.
6. A megnyíló Google-bejelentkezésnél azt a fiókot válaszd, amely a projekt tulajdonosa. A program telepíti a Hosting-fájlokat **és** a Firestore-szabályokat. Nem állít be számlázást.

A parancs a meglévő Codex Node/pnpm futtatókörnyezetet is használni tudja. Másik gépen Node.js LTS és npm szükséges.

Manuálisan, telepített Node/npm mellett:

```sh
npx firebase-tools login
npx firebase-tools deploy --only hosting,firestore:rules --project wortkarten-58af7
```

Sikeres közzététel után: https://wortkarten-58af7.web.app

A konfiguráció megadása önmagában nem telepíti az appot. A fenti cím csak sikeres deploy után használható. A Firebase-hozzáférés nem jár együtt a ChatGPT GitHub-csatlakozásával.

## Biztonság és szinkronizálás

A `public/config.js` nyilvános webkonfiguráció, nem adminisztrátori hitelesítő adat. Ne tölts fel service account kulcsot. A `firestore.rules` a `/users/{uid}/marks/{wordId}` dokumentumokat kizárólag az adott fióknak engedélyezi, csak boolean jelölésekkel és szerveridővel. Minden más adatút tiltott. A weboldal és a szókészlet nyilvános, a személyes jelölések nem.

Egy szó két jelölése külön mezőként frissül, ezért másik eszközön az elrejtés módosítása nem írja felül a kedvenc módosítását. Ugyanannak a mezőnek egyidejű módosításakor az utoljára szerverre érkező írás érvényesül. Internetkimaradáskor a várakozó módosítások fiókonként a böngésző helyi tárhelyében maradnak; a nyitott app újrakapcsolódáskor feltölti őket. A böngészőadatok törlése a még fel nem töltött jelöléseket is törli.

Bejelentkezés nélkül helyi vendégmód működik. A vendégjelölések nem kerülnek automatikusan egy másik fiókhoz: exportáld őket, jelentkezz be, majd importáld. Fiókváltáskor az aktuális gyakorlás lezárul. Az app internet nélkül, korábbi betöltés után a gyorsítótárból is megnyílhat; a Google-bejelentkezés és a felhőkapcsolat internetet igényel.

## Mac-jelölések átvitele

A natív alkalmazás ••• → Jelölések exportálása menüpontjával készített JSON-t a webalkalmazás ••• → Jelölések importálása menüpontjában válaszd ki, lehetőleg bejelentkezés után. Az importált szavak jelölései felülírják ugyanazon szavak aktuális jelöléseit. A többi jelölés megmarad. A jelenlegi és egyértelmű régi azonosítókat is felismeri. A natív Mac-app önmagában nem szinkronizál a Firebase-zal; ehhez Macen is a webes változatot használd.

## Fejlesztés

```sh
npm test
npm start
```

Nincs buildlépés vagy alkalmazásfüggőség telepítése: natív JavaScript-modulok és a Google CDN-ről betöltött, rögzített Firebase SDK 12.19.0. A `public/` a közzéteendő mappa. A tesztek a teljes szólistán ellenőrzik a rangokat, szinteket, szűrőket, importot, névelőgyakorlást és szinkronizálási műveletek összevonását.

Statikus fájlfrissítéskor növeld a `public/sw.js` cache-verzióját is. A GitHub-tároló a forráskódot tárolja; az automatikus Firebase-deploy külön, a tulajdonos hitelesítésével állítható be. Nincs előre engedélyezett GitHub Actions workflow vagy titkos kulcs.
