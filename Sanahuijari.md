# Sanahuijari-peli

Sanahuijari-pelissä Sanahuijari yrittää bluffata tiensä ulos ja esittää tietävänsä Salasanan. Etsivien tehtävänä on selvittää, että kuka tai ketkä ovat Sanahuijareita. Sanahuijari voittaa, mikäli Etsivät eivät saa Sanahuijaria kiinni bluffaamisesta. Sanahuijarin jäädessä kiinni, hän voi silti voittaa arvaamalla Salasanan oikein. Etsivien tuleekin varoa paljastamasta Salasanaa ja olla antamatta liian helppoja vihjeitä! Sanahuijari-pelissä kuumottavia tilanteita riittää!

Sanahuijari on porukkapeli (party-peli), jota pelataan yhdellä puhelimella. Puhelinta kierrättämällä Sanahuijari-sovellus jakaa kaikille pelaajille kortit ja varsinainen pelaaminen tapahtuu puhumalla kasvotusten.

Sanahuijari-sovellusta ei tarvitse asentaa, eikä pelaaminen edellytä ylimääräistä säätämistä. Pelisäännöt ovat yksinkertaiset ja helposti sovellettavat. Tarvitset vain 3 pelaajaa, eikä pelaajamäärälle ole ylärajaa.

Sopii pelattavaksi perheiltoihin, juhliin tai vaikka kahvitteluhetkiin!

https://sanahuijari.fi


## Määritelmät

Pelin nimi: Sanahuijari
Pelimestari: Pelaaja, joka luo ja käynnistää pelin
PWA-sovellus: Progressive Web App, webbisovellus joka kääntyy helposti mobiiliappiksi
Salasana: Pelissä arvattava sana
Vaikeustaso: Määrittää salasanan arvaamisen vaikeuden
Salasanakategoria: Salasanan kategoria, yhdellä salasanalla voi olla useampi kategoria
Sanahuijari: Pelaaja, joka ei tiedä salasanaa
Etsivä: Pelaaja, joka tietää Salasanan ja yrittää päätellä Sanahuijarin
Kortti: Pelaajille jaettavat kortit, josta etsivät näkevät kortista salasanan ja Sanahuijarit näkevät peliasetuksista riippuen jotain muuta


## Pelikokemus

1. Pelimestari avaa puhelimella Sanahuijari-PWA-sovelluksen tai nettisivun https://sanahuijari.fi
2. Pelimestari määrittää Sanahuijari-pelin asetukset;
	- Pelaajamäärä: 3, 4, 5, 6, tai enemmän
	- Vaikeustaso: Satunnainen, Helppo, Keskitaso, Vaikea
	- Sanaluokat: Satunnainen, Avaruus, Ruoka, Eläin, Nähtävyys, Esine
	- Toggle-asetusvalinta: Etsivät näkevät salasanan lisäksi salasanakategorian
	- Toggle-asetusvalinta: Sanahuijarit näkevät salasanakategorian
	- Toggle-asetusvalinta: Sanahuijarit tietävät olevansa huijareita
	- Toggle-asetusvalinta: Sanahuijarit saavat väärän salasanan samasta salasanakategoriasta
	- Toggle-asetusvalinta: Sanahuijareita voi olla useampi (1:5 todennäköisyys)
	- Toggle-asetusvalinta: Sanahuijari näkee kuinka huijaria pelissä on
3. Pelimestari käynnistää pelin täppäämällä "Aloita Sanahuijari-peli"
	- Peli arpoo salasanan sekä Etsivät ja Sanahuijarit
4. Jokainen pelaaja vuorollaan katsoo kortin paljastamatta korttia muille pelaajille:
	- Täppäämällä "Näytä kortti" pelaaja näkee oman korttinsa
		- Jos pelaaja on Etsivä, riippuen asetuksista;
			- Etsivä näkee Salasanan (esim. "Pahat pojat")
			- Etsivä voi nähdä salasanakategorian (esim. "Suomi / Elokuva")
		- Jos pelaaja on Sanahuijari, riippuen asetuksista;
			- Sanahuijari voi nähdä, että hän on huijari ("Olet Sanahuijari")
			- Sanahuijari voi nähdä salasanakategorian (esim. "Suomi / Elokuva")
			- Sanahuijari voi nähdä väärän salasanan (esim. "Tuntematon sotilas")
			- Sanahuijari voi nähdä Sanahuijarien lukumäärän (esim. "Pelissä on 2 Sanahuijaria")
	- Täppäämällä "Piilota kortti" pelaaja piilottaa oman korttinsa ja antaa puhelimen seuraavalle
		- "Näytä kortti" -painikkeessa on 2 sekunnin ajastin vähentääkseen vahinkopainalluksia
5. Kun kaikki pelaajat ovat nähneet korttinsa, peli käynnistyy ja puhelin asetetaan sivuun
6. Jokainen pelaaja vuorollaan kertoo vihjeen arvattavasta sanasta
	- Pelaaja antaa yhden vihjeen vuorollaan
	- Kaksi kierrosta, eli jokainen pelaaja antaa kaksi vihjettä yhteensä
	- Ensimmäisen kierroksen aloittaa eri henkilö kuin aikaisemmassa pelissä
7. Lopuksi käydään vapaamuotoista keskustelua ja päättelyä, jonka jälkeen pelaajat äänestävät Sanahuijaria
	- Pelaajat eivät saa yrittää perustella omia sanoja tarkemmin
	- Mikäli Sanahuijari jää kiinni, Sanahuijari voittaa arvaamalla sanan tai häviää
	- Mikäli Sanahuijari ei jää kiinni, Sanahuijari voittaa
8. Pelimestari lopettaa pelin täppäämällä "Päätä peli"
    - Lopuksi näytetään Sanahuijarien ja Etsivien kortit


## Pelisäännöt

### Tavoite
- **Etsivät** tietävät Salasanan ja yrittävät löytää Sanahuijari(t) paljastamatta Salasanaa.
- **Sanahuijari(t)** ei tiedä Salasanaa: bluffaa, pysy piilossa ja yritä päätellä Salasana vihjeistä.

### Kortit
- Jokainen katsoo korttinsa **vuorollaan** paljastamatta sitä muille.
- **Etsivä** näkee kortista Salasanan (ja asetuksista riippuen myös salasanakategorian).
- **Sanahuijari** voi nähdä asetuksista riippuen esimerkiksi:
- "Olet Sanahuijari" -tekstin
- salasanakategorian vihjeenä
- väärän salasanan samasta kategoriasta
- Sanahuijarien lukumäärän

### Vihjekierrokset
1. Kun kaikki ovat nähneet korttinsa, laite sivuun.
2. Pelataan **2 kierrosta**.
3. Jokaisella kierroksella jokainen pelaaja antaa **yhden vihjeen** Salasanasta (yhteensä **2 vihjettä per pelaaja**).
4. Vihjeen jälkeen ei saa selitellä tai puolustella omaa vihjettä.
5. Vuoron aloittaja vaihtuu pelistä toiseen (esim. myötäpäivään kiertäen).

### Äänestys ja voitto
- Vihjeiden jälkeen keskustellaan ja äänestetään, ketkä ovat Sanahuijareita.
- **Jos Sanahuijari(t) ei jää kiinni äänestyksessä → Sanahuijari(t) voittaa.**
- **Jos Sanahuijari(t) jää kiinni → Sanahuijari(t) saa arvata Salasanan yhden kerran.**

- Oikein → Sanahuijari(t) voittaa.
- Väärin → Etsivät voittavat.

Halutessa voitte pitää kirjaa Salasanoista, vihjeistä, Sanahuijareista ja voittajista.


## Tekniset vaatimukset

- Käyttöliittymä suunniteltu ensisijaisesti puhelimella käytettäväksi
- Käyttöliittymän tulee olla selkeä ja tekstin tulee olla riittävän suurta helposti luettavaksi
- Käyttöliittymän tulee olla intuitiivinen ja helposti lähestyttävä
- Käyttöliittymän tulee olla iloinen, pirteä ja värikäs
- Pelin tulee toimia täysin client-puolella ilman palvelinriippuvuuksia
- HTML + CSS + Bootstrap + Javascript + jQuery
- Pelillä tulee olla täydellinen PWA-tuki, jolla on yhtenäinen ilme Android- ja iOS-puhelimilla
- Sanapankki tallennetaan JSON-muodossa
- Sanapankin tulee sisältää riittävästi sanoja eri vaikeustasoille ja kategorioille