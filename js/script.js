function inicjujLicznik() {
    fetch('token.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Błąd sieci');
            }
            return response.json();
        })
        .then(data => {
            var expiryDate = new Date(data.expiry_date);

            var countDownDate = expiryDate.getTime();

            var x = setInterval(function () {

                var now = new Date().getTime();

                var distance = countDownDate - now;

                var days = Math.floor(distance / (1000 * 60 * 60 * 24));
                var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                var seconds = Math.floor((distance % (1000 * 60)) / 1000);

                document.getElementById("licznik").innerHTML = days + "d " + hours + "h "
                    + minutes + "m " + seconds + "s ";

                if (distance < 0) {
                    clearInterval(x);
                    document.getElementById("licznik").innerHTML = "TOKEN WYGASŁ";
                }
            }, 1000);
        })
        .catch(error => {
            console.error('Wystąpił problem z odczytem pliku token.json:', error);
            document.getElementById("licznik").innerHTML = "Błąd wczytywania danych";
        });
}

window.onload = inicjujLicznik;
