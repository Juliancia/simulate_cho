# Symulator Hodowli Komórek CHO i Optymalizacji Gradientowej

Aplikacja została zaprojektowana na potrzeby warsztatów, pokazów laboratoryjnych, dni otwartych uczelni oraz festiwali nauki. Jej celem jest zademonstrowanie w przystępny i angażujący sposób, jak metody biologii cyfrowej, bioinformatyki i algorytmów optymalizacji matematycznej rewolucjonizują nowoczesną biofarmację, pozwalając zaoszczędzić tygodnie pracy przy bioreaktorach oraz dziesiątki tysięcy złotych na drogich odczynnikach.


## 1. O projekcie i idea dydaktyczna

W klasycznym laboratorium biotechnologicznym optymalizacja parametrów hodowli komórek ssaczych odbywa się metodą prób i błędów lub żmudnych planów eksperymentów (Design of Experiments - DoE). Każda próba wymaga sterylnych odczynników, pożywek, energii do zasilania inkubatorów CO2 oraz odczekania kilku dni na wzrost komórek.

Nasz symulator składa się z dwóch powiązanych ze sobą modułów:
1. **Laboratorium doswiadczalne**: Użytkownik manualnie dobiera parametry bioreaktora (temperaturę, pH, stężenie glukozy), inkubuje próbkę, przeprowadza test żywotności błękitem trypanu pod wirtualnym mikroskopem i obserwuje rosnące koszty finansowe oraz czasowe.
2. **Biologia cyfrowa**: Użytkownik przechodzi do modułu optymalizacyjnego, analizuje krzywe odpowiedzi 2D, poznaje analityczną funkcję żywotności i uruchamia wspinaczkę gradientową (Gradient Ascent) w przestrzeni 3D, która w ułamku sekundy znajduje globalne optimum hodowli.


## 2. Podloze biologiczne i bioinżynieryjne

### Komorki CHO (Chinese Hamster Ovary)
Komórki jajnika chomika chińskiego są niekwestionowanym złotym standardem światowej biofarmacji:
- Ponad 70-80% wszystkich współczesnych leków biologicznych (w tym przeciwciała monoklonalne mAbs stosowane w onkologii i reumatologii, cytokiny oraz erytropoetyna) jest wytwarzanych w liniach komórkowych CHO.
- Jako komórki ssacze posiadają aparat enzymatyczny zdolny do przeprowadzania modyfikacji potranslacyjnych (przede wszystkim prawidłowej glikozylacji białek). Dzięki temu wyprodukowane leki nie wywołują groźnej odpowiedzi immunologicznej w organizmie pacjenta.
- Zostały zaadaptowane do wzrostu w zawiesinie w reaktorach o objętości od kilku do kilkudziesięciu tysięcy litrów.
- Są naturalnie oporne na większość wirusów patogennych dla człowieka.

### Test wykluczenia blekitem trypanu (Trypan Blue Exclusion Assay)
Żywotność komórek weryfikowana jest jedną z najważniejszych metod laboratoryjnych:
- **Komorki zywe**: Posiadają nienaruszoną, szczelną błonę komórkową z aktywnym transportem błonowym. Cząsteczki barwnika nie przenikają do wnętrza. Pod mikroskopem kontrastowo-fazowym komórki są jasne, perłowe i załamują światło.
- **Komorki martwe**: Utraciły integralność błony komórkowej (apoptoza lub nekroza). Błękit trypanu gwałtownie dyfunduje do cytoplazmy i łączy się z białkami wewnątrzkomórkowymi. Komórka wybarwia się na intensywny, ciemnoniebieski (kobaltowy) kolor z ciemnym jądrem.

### Kinetyka i ekonomia bioreaktora
- **Glukoza**: Podstawowe źródło węgla i energii. Zgodnie z kinetyką enzymatyczną Monoda niedobór glukozy hamuje wzrost, natomiast jej nadmiar (>6 g/L) wywołuje efekt Crabtree, nadprodukcję kwasu mlekowego oraz stres hiperosmotyczny. Optimum leży w okolicach 4.5 g/L.
- **Temperatura**: Optimum fizjologiczne wynosi 37.0 st. C. Spadek temperatury spowalnia metabolizm (hipotermia), natomiast wzrost powyżej 39 st. C prowadzi do denaturacji białek i śmierci cieplnej.
- **pH**: Optymalna kwasowość pożywki to 7.20. Kwasica (pH < 6.8) lub zasadowość (pH > 7.6) zaburzają potencjał błonowy komórek.
- **Koszty**: Pojedyncza seria mikrotestowa to koszt rzędu 180 PLN (odczynniki, certyfikowane naczynia, sterylne filtry, zasilanie inkubatora). W skali pilotażowej (10-50 L) jedna nieudana partia to strata od 15 000 do 50 000 PLN.


## 3. Model matematyczny i algorytm optymalizacji

W module cyfrowym wielowymiarowa funkcja żywotności komórek zdefiniowana jest jako iloczyn znormalizowanych funkcji cząstkowych:

$$f(T, \text{pH}, G) = 98.2\% \cdot f_T(T) \cdot f_{\text{pH}}(\text{pH}) \cdot f_G(G)$$

Gdzie:
- $f_T(T)$ - asymetryczna funkcja termiczna uwzględniająca gwałtowną denaturację cieplną powyżej 37.0 st. C:
  $$f_T(T) = \exp\left( -\frac{(T - 37.0)^2}{2 \sigma_T^2} \right), \quad \sigma_T = \begin{cases} 4.0 & \text{dla } T \le 37.0 \\ 2.4 & \text{dla } T > 37.0 \end{cases}$$
- $f_{\text{pH}}(\text{pH})$ - symetryczny rozkład Gaussa wokół optimum fizjologicznego:
  $$f_{\text{pH}}(\text{pH}) = \exp\left( -\frac{(\text{pH} - 7.20)^2}{2 \cdot 0.35^2} \right)$$
- $f_G(G)$ - model kinetyki Monoda z inhibicją substratową:
  $$f_G(G) = \begin{cases} \frac{G / (G + 0.5)}{4.5 / (4.5 + 0.5)} & G \le 4.5 \\ \frac{1}{1 + 0.12(G - 4.5)^{1.6}} & G > 4.5 \end{cases}$$

#### Założenie inżynieryjne: uproszczenie sprzężeń skrośnych
W żywej komórce parametry wpływają na siebie dynamicznie (podwyższona temperatura przyspiesza glikolizę i produkcję kwasu mlekowego, który wtórnie zakwasza pożywkę i obniża pH). W symulatorze zastosowano model multiplikatywny bez nieliniowych sprzężeń skrośnych ($T \times \text{pH} \times G$). Jest to celowe uproszczenie inżynieryjne (standard metodyki *Response Surface Methodology – RSM*), które eliminuje zbędną komplikację w postaci układów nieliniowych równań różniczkowych (ODE) i zapewnia przejrzystą demonstrację wspinaczki gradientowej. W warunkach przemysłowych taką stabilizację parametrów realizują regulatory PID bioreaktora.

### Wspinaczka gradientowa (Gradient Ascent)
Algorytm wyszukuje maksimum funkcji żywotności w trójwymiarowej przestrzeni parametrów $[T, \text{pH}, G]$:

$$\mathbf{x}_{k+1} = \mathbf{x}_k + \gamma \cdot \nabla f(\mathbf{x}_k)$$

Wektor gradientu $\nabla f = [\frac{\partial f}{\partial T}, \frac{\partial f}{\partial \text{pH}}, \frac{\partial f}{\partial G}]^T$ wskazuje kierunek najszybszego wzrostu żywotności. W aplikacji obliczany jest numerycznie metodą centralnych ilorazów różnicowych:

$$\frac{\partial f}{\partial x_i} \approx \frac{f(\mathbf{x} + h_i \mathbf{e}_i) - f(\mathbf{x} - h_i \mathbf{e}_i)}{2 h_i}$$

Dla każdego kroku wspinaczki generowana jest pełna telemetria numeryczna oraz wizualizowana jest płaszczyzna styczna w trójwymiarowej przestrzeni parametrów.


## 4. Architektura i technologie

Aplikacja została zaprojektowana w architekturze **Zero-Build Single Page Application (SPA)**. Działa w pełni po stronie przeglądarki klienta, bez konieczności kompilacji, instalowania środowisk uruchomieniowych Node.js czy bundlerów (Webpack/Vite).

### Zastosowany stack technologiczny:
- **HTML5 i semantyczny DOM**: Dwuetapowy interfejs użytkownika z podziałem na Laboratorium oraz Biologię Cyfrową.
- **Vanilla JavaScript (ES2022 Modules)**: Modularny kod w standardzie ES Modules (`model.js`, `microscope.js`, `optimizer.js`, `app.js`).
- **Tailwind CSS**: Nowoczesny framework CSS ładowany przez CDN, w pełni ostylowany zgodnie z identyfikacją wizualną koła naukowego (paleta barw: `#1B1D3A`, `#4043A0`, `#DFEFF6`, `#C4455C` oraz typografia nagłówkowa `Gochi Hand` i `Sriracha`).
- **Oficjalne logo koła**: Zintegrowane zasoby graficzne z repozytorium `biologiacyfrowa/website_BC` umieszczone w nawigacji oraz stopce.
- **HTML5 Canvas 2D (Mikroskop cyfrowy)**:
  - Własny silnik cząsteczkowy renderujący komórki CHO w rozdzielczości Retina (DPR).
  - Deterministyczne tasowanie algorytmem Fishera-Yatesa gwarantujące zgodność liczby żywych i martwych komórek ze statystykami.
  - Jednorodny rozkład przestrzenny na tarczy okularu za pomocą odwracania dystrybuanty (Inverse Transform Sampling: $r = R \sqrt{U}$).
  - Symulacja płynnego ruchu Browna i organicznego kołysania w cieczy hodowlanej.
  - Płynna animacja fali błękitu trypanu i optyki kontrastowo-fazowej.
- **HTML5 Canvas 3D (Powierzchnia odpowiedzi i gradient)**:
  - Autorski silnik projekcji 3D z możliwością pełnego, płynnego obracania kątów kamery (yaw / pitch) myszą lub gestem dotykowym na smartfonie.
  - Interaktywny krajobraz żywotności 3D (Surface Plot) z osiami: pH (od lewej), Temperatura (w głąb), Żywotność (wysokość).
  - Cieniowanie hipsometryczne od chłodnego błękitu przez zieleń do złota (optimum 98.2%).
  - Nanoszenie wektora gradientu $\nabla f$, trajektorii wspinaczki oraz trójwymiarowej płaszczyzny stycznej przylegającej do zbocza.
- **Wykresy parametrów 2D**: Klasyczne wykresy statystyczne 2D przedstawiające pojedyncze przekroje parametrów na czystym, jasnym tle.
- **KaTeX**: Biblioteka renderująca notację matematyczną LaTeX w czasie rzeczywistym.
- **Lucide Icons**: Wektorowy zestaw ikon interfejsu.


## 5. Bezpieczeństwo i izolacja danych lokalnych

Aplikacja nie posiada centralnego serwera bazodanowego i nie wysyła żadnych danych telemetrycznych na zewnątrz:
- Wszystkie wyniki prób laboratoryjnych, poniesione koszty oraz aktualne nastawy bioreaktora zapisywane są **wyłącznie w pamięci lokalnej przeglądarki użytkownika (`window.localStorage`)**.
- Każde urządzenie (smartfon uczestnika warsztatów, komputer na stoisku, tablet) stanowi w pełni niezależną piaskownicę.
- Dane nie przepadają po odświeżeniu strony ani po ponownym otwarciu przeglądarki.
- Użytkownik w każdej chwili może zresetować swoje dane lokalne za pomocą przycisku **Wyczyść dane**.

---

## 6. Instrukcja korzystania z symulatora

### Krok 1: Próba manualna w laboratorium
1. W sekcji **Parametry Bioreaktora** ustaw suwakami początkowe warunki hodowli (np. temperatura 34.0 st. C, pH 6.60, glukoza 2.0 g/L).
2. Kliknij przycisk **Zainkubuj Próbkę (3.5 dnia w labie)**. Na liczniku pojawi się koszt 180 PLN oraz naliczona zostanie pierwsza próba.
3. W podglądzie mikroskopu pojawią się komórki CHO w zawiesinie.
4. Kliknij podświetlony przycisk **Wpuść Błękit Trypanu (Test Żywotności)**.
5. Obserwuj animację barwienia: komórki martwe przybiorą kolor kobaltowy, komórki żywe pozostaną jasne. Karta wyników wskaże aktualną żywotność oraz gęstość komórek.
6. Wynik zostanie odnotowany w tabeli **Dziennik Prób Laboratoryjnych**.

### Krok 2: Optymalizacja cyfrowa (Biologia Cyfrowa)
1. Kliknij przycisk **Włącz Biologię Cyfrową (Optymalizacja)** na górnym pasku lub pod tabelą prób.
2. Zapoznaj się z wykresami 2D parametrów oraz analityczną funkcją celu $f(T, \text{pH}, G)$ wypisaną w notacji matematycznej.
3. W sekcji symulatora wspinaczki 3D kliknij **Uruchom Wspinaczkę Gradientową**.
4. Obserwuj animację 3D: algorytm wędruje w przestrzeni parametrów ku optimum z komfortowym czasem kroku (700 ms). W tabeli poniżej analizuj kolejne iteracje, wyliczone pochodne cząstkowe $\nabla f$ oraz wektor parametrów.
5. Po osiągnięciu maksimum kliknij przycisk **Zastosuj Wyliczone Optimum w Bioreaktorze**.

### Krok 3: Weryfikacja laboratoryjna optimum
1. Aplikacja przeniesie Cię z powrotem do laboratorium, a suwaki bioreaktora zostaną automatycznie ustawione na wyznaczone optimum:
   - Temperatura: 37.0 st. C
   - pH: 7.20
   - Glukoza: 4.5 g/L
2. Kliknij **Zainkubuj Próbkę** z nowymi parametrami.
3. Kliknij **Wpuść Błękit Trypanu**.
4. Przekonaj się, że niemal wszystkie komórki w okularze są żywe (żywotność >98%), a gęstość osiąga poziom docelowy. Otrzymasz podsumowanie sukcesu z kalkulacją zaoszczędzonego czasu i budżetu!


## 7. Jak sklonowac i uruchomic projekt lokalnie

Do uruchomienia projektu na własnym komputerze nie jest wymagane instalowanie skomplikowanych bibliotek ani kompilatorów. Ponieważ kod wykorzystuje natywne moduły JavaScript (ES Modules), pliki muszą być serwowane przez dowolny lokalny serwer HTTP (bezpośrednie otwarcie pliku przez dwuklik `file:///` jest blokowane przez politykę bezpieczeństwa CORS nowoczesnych przeglądarek).

### Krok 1: Klonowanie repozytorium z GitHuba
Otwórz terminal (macOS / Linux) lub wiersz poleceń / PowerShell (Windows) i wpisz:

```bash
git clone https://github.com/biologiacyfrowa/cho-bioreactor-simulator.git
```

Przejdź do pobranego folderu:
```bash
cd cho-bioreactor-simulator
```

### Krok 2: Uruchomienie lokalnego serwera

Wybierz najwygodniejszą dla siebie opcję spośród zainstalowanych na Twoim komputerze narzędzi:

#### Opcja A: Poprzez Pythona (zalecana, Python jest domyślnie w większości systemów)
```bash
python3 -m http.server 8000
```
(W systemie Windows, jeśli komenda `python3` nie działa, wpisz: `python -m http.server 8000`)

#### Opcja B: Poprzez Node.js / npx
```bash
npx serve .
```
lub
```bash
npx http-server -p 8000
```

#### Opcja C: Poprzez rozszerzenie Visual Studio Code
1. Otwórz folder projektu w edytorze **VS Code**.
2. Zainstaluj oficjalne rozszerzenie **Live Server** (autor: Ritwick Dey).
3. Kliknij prawym przyciskiem myszy na plik `index.html` i wybierz opcję **Open with Live Server** (lub kliknij przycisk *Go Live* na dolnym pasku).

#### Opcja D: Poprzez PHP
```bash
php -S localhost:8000
```

### Krok 3: Otwarcie w przegladarce
Po uruchomieniu serwera otwórz przeglądarkę internetową (Chrome, Firefox, Safari lub Edge) i wpisz adres:
```
http://localhost:8000
```
Aplikacja jest w pełni gotowa do działania.

---

## 8. Wdrozenie na GitHub Pages

Repozytorium można w prosty sposób opublikować jako bezpłatną stronę internetową dostępną publicznie dla wszystkich użytkowników:

1. Wypchnij kod do swojego repozytorium na GitHubie na gałąź `main`:
   ```bash
   git add .
   git commit -m "Wdrozenie symulatora CHO"
   git push origin main
   ```
2. Przejdź do repozytorium na portalu GitHub w przeglądarce.
3. Kliknij zakładkę **Settings**, a następnie w menu bocznym wybierz **Pages**.
4. W sekcji **Build and deployment**:
   - Ustaw **Source** na: `Deploy from a branch`.
   - Ustaw **Branch** na: `main` oraz katalog `/(root)`.
   - Kliknij przycisk **Save**.
5. Po około 1 minucie aplikacja będzie aktywna pod adresem:
   `https://<twoj-login-lub-organizacja>.github.io/<nazwa-repozytorium>/`

Link ten można umieścić w kodzie QR na plakatach i stoiskach targowych.

## 9. O SKN Cyfrowi Biolodzy

**Studenckie Koło Naukowe Cyfrowi Biolodzy** działa przy Wydziale Biologii i Ochrony Środowiska Uniwersytetu Łódzkiego. Zrzesza studentów kierunku Biologia i Biomedycyna Cyfrowa oraz pasjonatów informatyki, bioinformatyki, biologii molekularnej, analizy danych omicznych i sztucznej inteligencji w naukach o życiu.

- Organizacja: Studenckie Koło Naukowe Cyfrowi Biolodzy
- Uczelnia: Uniwersytet Łódzki
- GitHub: [https://github.com/biologiacyfrowa](https://github.com/biologiacyfrowa)
- Repozytorium strony koła: [https://github.com/biologiacyfrowa/website_BC](https://github.com/biologiacyfrowa/website_BC)
