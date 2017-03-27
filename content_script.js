addScores();

var count = 0;
var scrollTimer,
    lastScrollFireTime = 0;

$(document).scroll(timedAction);
$(window).bind('hashchange', addScores());
document.addEventListener("click", addScores);
document.addEventListener("DOMNodeInserted", addScores);

function timedAction() {
    var minScrollTime = 100;
    var now = new Date().getTime();

    if (!scrollTimer) {
        if (now - lastScrollFireTime > (3 * minScrollTime)) {
            var newCount = $(".review").length;
            if (newCount != count) {
                addScores();
            }
            lastScrollFireTime = now;
        }
        scrollTimer = setTimeout(function() {
            scrollTimer = null;
            lastScrollFireTime = new Date().getTime();
            addScores();
        }, minScrollTime);
    }
}

function addScores() {
    count = $(".review").length;
    $(".review").each(function(index) {
        var link = $(this).children(".album-link");
        var title = $(this).find(".meta");
        var href = $(link[0]).attr('href');

        if (!$(this).hasClass("addedScore")) {
            $(this).addClass("addedScore");
            $.get(href, function(data) {
                var rating = parseRating(data);
                $(title).prepend("<h2 class=\"genre-list\"><a href=\"" + href + "\"> Score: " + rating + "</a></h2>");
            });
        }
    });
}



// for (album in albums) {
//     console.log(album.querySelector("a"));

//     var albumArt = $(album).find(".album-link");
//     console.log(albumArt[0]);
//     console.log($(albumArt[0]).attr("href"));
// }



function parseRating(data) {
    var html = $($.parseHTML(data)).find(".score");
    var numeric = parseFloat(html.text());
    return numeric.toFixed(1).toString();
}