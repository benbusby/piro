$(document).ready(function () {

    var text = document.body;
    var str = text.innerHTML,
        reg = /DELETE|GET|POST|PUT/ig;

    var toStr = String(reg);
    var color = (toStr.replace('\/g', '|')).substring(1);

    var colors = color.split("|");

    if (colors.indexOf("DELETE") > -1) {
        str = str.replace(/DELETE/g, '<span style="color:red; background-color:black; padding:2 2 0 2; border-radius:2px; font-weight:bold;">DELETE</span>');
    }

    if (colors.indexOf("GET") > -1) {
        str = str.replace(/GET/g, '<span style="color:cyan; background-color:black; padding:2 2 0 2; border-radius:2px; font-weight:bold;">GET</span>');
    }

    if (colors.indexOf("POST") > -1) {
        str = str.replace(/POST/g, '<span style="color:lawngreen; background-color:black; padding:2 2 0 2; border-radius:2px; font-weight:bold;">POST</span>');
    }

    if (colors.indexOf("PUT") > -1) {
        str = str.replace(/PUT/g, '<span style="color:yellow; background-color:black; padding:2 2 0 2; border-radius:2px; font-weight:bold;">PUT</span>');
    }

    document.body.innerHTML = str;
});
