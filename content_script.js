$(document).ready(function() {
    //Get all courses
    var courses = $(".course-info");

    var total_spots = 0;
    var available_spots = 0;
    var professor_ratings;
    var url_template = "http://www.ratemyprofessors.com/ShowRatings.jsp?tid=";



    var xhr = new XMLHttpRequest;
    xhr.open("GET", chrome.runtime.getURL("data/only_ratings.json"));
    xhr.onreadystatechange = function() {
        if (this.readyState == 4) {
            professor_ratings = JSON.parse(xhr.responseText);
            start();
        }
    };
    xhr.send();

    function start() {
        //Iterate over courses on page
        for (var i = 0; i < courses.length; i++) {
            total_spots = 0;
            available_spots = 0;
            //Get table with jQuery selector
            var table = $(courses[i]).find("> .course-details > table.sections");

            //Get rows, iterate over each one
            var rows = $(table[0]).find("> tbody > tr").each(function() {
                if ($(this).hasClass("headers")) {
                    $(this).find('.instructor').after('<th>Prof. Rating</th>');
                    //jQuery's version of continue
                    return true;
                }
                var type = $(this).find("td.type");
                if (type.length != 0) {
                    type = type[0].textContent;
                } else {
                    return true;
                }
                var registration_numbers = $(this).find("td.registered")[0].textContent.split(" of ");
                var current_enrolled = parseInt(registration_numbers[0]);
                var total_available = parseInt(registration_numbers[1]);

                //If it's not a lab or quiz
                if (type == "Lecture" || type == "Lecture-Lab") {
                    total_spots += total_available;
                    available_spots += (total_available - current_enrolled);
                }

                var professor = $(this).find("td.instructor")[0];
                var professor_name = professor.textContent.split(",");
                for (var i = 0; i < professor_name.length; i++) {
                    split_prof = professor_name[i];
                    var actual_name = split_prof.split(" ");
                    actual_name = actual_name[0] + " " + actual_name[actual_name.length - 1];
                    if (actual_name in professor_ratings) {
                        var url = url_template + professor_ratings[actual_name].id;
                        if ($(this).find('.rating').length == 0) {
                            $(this).find('td.instructor').after('<td class="rating"><a href=' + url + ">" + professor_ratings[actual_name].rating + '</a></td>');
                        } else {
                            $(this).find('.rating').append(', <a href=' + url + ">" + professor_ratings[actual_name].rating + '</a>');
                        }
                    } else {
                        if ($(this).find('.rating').length == 0) {
                            $(this).find('td.instructor').after('<td class="rating"> </td>');
                        } else {
                            $(this).find('.rating').append(' ');
                        }
                    }
                }
            });

            var title = $(courses[i]).find("> .course-id > h3 > a");
            if (total_spots != 0) {
                title.append(" - " + available_spots + " remaining spots");
            }
        }
    }
});