document.getElementById("upload").addEventListener("change", function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // set the image src to the uploaded file
            document.getElementById("profile-pic").src = e.target.result;
        };
        reader.readAsDataURL(file); // convert file to base64 URL
    }
});