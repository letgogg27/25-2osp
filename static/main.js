const dataTransfer = new DataTransfer();
const fileInput = document.getElementById("images");
const previewContainer = document.getElementById("image-previews");

fileInput.addEventListener("change", function (event) {
  const newFiles = event.target.files;

  for (let i = 0; i < newFiles.length; i++) {
    dataTransfer.items.add(newFiles[i]);
  }

  fileInput.files = dataTransfer.files;

  renderPreviews();

  event.target.value = null;
});

function renderPreviews() {
  previewContainer.innerHTML = "";

  for (let i = 0; i < dataTransfer.files.length; i++) {
    const file = dataTransfer.files[i];
    const reader = new FileReader();

    reader.onload = function (e) {
      const previewWrapper = document.createElement("div");
      previewWrapper.className = "preview-item";
      previewWrapper.dataset.index = i;

      // Basic styling for container
      previewWrapper.style.cssText =
        "width:100px; height:100px; overflow:hidden; position:relative; border: none;box-shadow: 1px 1px 3px rgba(0,0,0,0.1);";

      const img = document.createElement("img");
      img.src = e.target.result;
      img.alt = file.name;
      img.style.cssText = "width:100%; height:100%; object-fit:cover;";

      const removeButton = document.createElement("button");
      removeButton.innerHTML = "×"; // Close icon
      removeButton.className = "remove-btn";
      // Styling for the button
      removeButton.style.cssText =
        "position:absolute; top:0; right:0; background:rgba(0, 0, 0, 0.4); color:white; border:none;cursor:pointer; padding:2px 6px; line-height:1; font-size:14px; z-index: 10;";

      removeButton.addEventListener("click", (event) => {
        event.preventDefault();
        removeFile(i);
      });

      previewWrapper.appendChild(img);
      previewWrapper.appendChild(removeButton);
      previewContainer.appendChild(previewWrapper);
    };

    reader.readAsDataURL(file);
  }
}

function removeFile(index) {
  dataTransfer.items.remove(index);

  fileInput.files = dataTransfer.files;

  renderPreviews();

  fileInput.required = dataTransfer.files.length === 0;
}
