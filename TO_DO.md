# Status Zadań (TO DO)

- [x] **1. Wyjaśnienie kosztów laboratorium i wyboru komórek CHO**:
  - Dodano rozwijaną kartę wiedzy bioinżynierskiej w widoku laboratorium.
  - Wyjaśniono, dlaczego komórki chomika chińskiego (CHO) są złotym standardem biofarmacji (70-80% leków biologicznych/przeciwciał mAbs, ludzkopodobna glikozylacja zapobiegająca szokowi immunologicznemu, wzrost w zawiesinie, bezpieczeństwo przed ludzkimi wirusami).
  - Wyszczególniono składniki kosztów każdej próby (~180 PLN w skali mikro, 15 000 – 50 000 PLN w skali pilotażowej: czyste chemicznie pożywki bezsurowicze CD CHO, jednorazowe filtry i naczynia, sterylny błękit trypanu, ciągłe zasilanie inkubatorów CO₂ przez 3.5–7 dni, wysoki koszt lizy i utylizacji nieudanej partii).

- [x] **2. Usunięcie dopisku o działaniu w 100% w przeglądarce**:
  - Usunięto fragment `• Działa w 100% w przeglądarce` ze stopki strony, pozostawiając czysty podpis: `Kierunek: Biologia i Biomedycyna Cyfrowa UŁ`.

- [x] **3. Źródło danych na wykresach (Wiedza a priori i stężenie glukozy)**:
  - Dodano specjalną notę naukową w module uczenia maszynowego (Krok 2).
  - Wyjaśniono pochodzenie danych z literatury biotechnologicznej i praw enzymatycznych: kinetyka Monoda dla zużycia glukozy ($K_s \approx 0.5\text{ g/L}$), efekt Crabtree / kwasica mleczanowa i hiperosmolalność przy $G > 6\text{ g/L}$, oraz optimum 4.5 g/L jako punkt równowagi metabolicznej.
  - Przedstawiono pochodzenie krzywych temperatury (37.0°C) i pH (7.20) z termodynamiki białek i homeostazy ssaków.

- [x] **4. Dokładna analityczna postać funkcji celu $f(T, \text{pH}, G)$**:
  - Wprowadzono pełny panel matematyczny KaTeX w Kroku 3.
  - Zaprezentowano iloczynowy wzór $f(T, \text{pH}, G) = 98.2\% \cdot f_T(T) \cdot f_{\text{pH}}(\text{pH}) \cdot f_G(G)$.
  - Wypisano wzory każdej składowej: asymetryczny rozkład termiczny $f_T(T)$ (uwzględniający szok termiczny $\sigma_T = 2.4$ powyżej 37°C), krzywą Gaussa kwasowości $f_{\text{pH}}(\text{pH})$ oraz kinetykę Monoda z inhibicją nadmiarem glukozy $f_G(G)$.
  - Wyjaśniono rolę wektora gradientu $\nabla f = [\frac{\partial f}{\partial T}, \frac{\partial f}{\partial \text{pH}}, \frac{\partial f}{\partial G}]^T$ i centralnych ilorazów różnicowych.

- [x] **5. Realistyczny przepływ po znalezieniu optimum (inkubacja + barwienie)**:
  - Kliknięcie „Zastosuj Wyliczone Optimum w Bioreaktorze” ustawia optymalne suwaki ($37.0^\circ\text{C}, 7.20, 4.5\text{ g/L}$) i przenosi użytkownika do laboratorium.
  - Wyłączono automatyczne uruchamianie inkubacji i barwienia.
  - Użytkownik jest prowadzony krok po kroku:
    1. Kliknięcie podświetlonego przycisku **„Zainkubuj Próbkę”** (odczekanie 3.5 dnia na namnożenie komórek).
    2. Kliknięcie podświetlonego przycisku **„Wpuść Błękit Trypanu”** (weryfikacja integralności błon komórkowych).
    3. Dopiero po tym etapie ukazuje się wielkie podsumowanie sukcesu i modal triumfu biologii cyfrowej i eksperymentalnej z podsumowaniem oszczędności!

- [x] **6. Przepisanie dokumentacji README.md (gotowe na push na GitHub, bez emotikon)**:
  - Usunięto 100% emotikon z całego pliku README.md (styl profesjonalny i akademicki).
  - Szczegółowo opisano stack technologiczny: Vanilla JS (ES Modules), HTML5 Canvas 2D/3D, Tailwind CSS, Chart.js, KaTeX, Lucide Icons.
  - Wyjaśniono ideę dydaktyczną, model biologiczny CHO oraz matematykę wspinaczki gradientowej.
  - Dodano precyzyjną instrukcję jak sklonować z GitHuba (`git clone`) i uruchomić lokalnie (Python `http.server`, `npx serve`, VS Code Live Server, PHP) oraz jak wdrożyć na GitHub Pages.

- [x] **7. Pełna niezależność urządzeń i lokalny zapis danych usera (LocalStorage)**:
  - Architektura w 100% po stronie klienta (Zero-Backend) — każde urządzenie i przeglądarka są w pełni odizolowane.
  - Wdrożono zapisywanie stanu użytkownika (`attempts`, `totalCost`, `history`, wartości suwaków) wyłącznie w pamięci podręcznej przeglądarki (`window.localStorage`).
  - Dane nie przepadają po odświeżeniu strony ani po zamknięciu przeglądarki.
  - Dodano przycisk „Wyczyść dane” obok tabeli prób laboratoryjnych, umożliwiający zresetowanie historii na żądanie użytkownika.

- [x] **8. Usunięcie skrótów ML oraz wzmianek o uczeniu maszynowym**:
  - Zgodnie z prawdą naukową i metodologiczną projekt opiera się na **optymalizacji matematycznej bioprocesu** (wspinaczka gradientowa na powierzchni odpowiedzi), a nie na uczeniu maszynowym.
  - Usunięto wszelkie skróty „ML” i odniesienia do „uczenia maszynowego” oraz „AI” z tytułów stron, nagłówków, przycisków, opisów dydaktycznych oraz pliku `README.md`.
  - Zaktualizowano nazwy modułów na: „Biologia Cyfrowa (Optymalizacja)”, „Optymalizacja Bioprocesu”, „Wspinaczka Gradientowa”.
