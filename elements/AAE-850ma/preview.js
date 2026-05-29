function(instance, properties) {
var preview = Math.min(properties.bubble.height, properties.bubble.width);
    
    var imgElement = document.createElement("IMG");
    imgElement.setAttribute("src", "//meta-q.cdn.bubble.io/f1760050166390x430477210054904800/pngtree-flat-business-icon-for-pdf-downloads-on-white-vector-png-image_41011092.jpg");
    imgElement.style.width = 0.8 * preview + "px";
    imgElement.style.verticalAlign = "middle";
    
    instance.canvas[0].appendChild(imgElement);



}