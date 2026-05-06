let randomNumber = Math.floor(Math.random() * 100) + 1;

function checkGuess() {
    let userGuess = document.getElementById("guessInput").value;
    let result = document.getElementById("result");

    if (userGuess == randomNumber) {
        result.textContent = "🎉 Correct!";
    } else if (userGuess > randomNumber) {
        result.textContent = "Too high!";
    } else {
        result.textContent = "Too low!";
    }
}