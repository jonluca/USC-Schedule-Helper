let professorRatings = {};
var options;
var id;
chrome.runtime.onMessage.addListener(onMessage);

function onMessage(message, sender, sendResponse) {
  if (message.action === 'optionsChanged') {
    options = message.options;
  }
}

$(() => {
  loadOptions(function (receivedOptions) {
    options = receivedOptions;
    if (receivedOptions.extensionEnabled) {
      startHelper();
    }
  });
});

function startHelper() {
  //Pages URL
  const currentURL = window.location.href;
  if (currentURL.includes("webreg")) {
    //Insert "Export to Calendar" button in nav bar
    insertExportButton();
  }
  //This loads the JSON of all the professors, rating, and unique ID. Only way I've found to get it, unfortunately, is
  // through a HTTPRequest Typically loads in ~40ms, so not a huge issue, I just wish there was a more efficient way of
  // doing it
  $.ajax({
    method: 'GET',
    url: chrome.runtime.getURL("data/ratings.json"),
    type: 'json',
    success(data, textStatus, jqXHR) {
      professorRatings = data;
      if (typeof(data) === "string") {
        professorRatings = JSON.parse(data);
      }
      //If we are on webreg or if we're on classes.usc.edu
      if (currentURL.includes("webreg") && !currentURL.includes("/myCourseBin")) {
        //Appending to body makes the stylesheet async
        $('body').append(`<link rel="stylesheet" href="${chrome.runtime.getURL("css/sweetalert.css")}" type="text/css" />`);
        if (options.showConflicts) {
          getCurrentSchedule();
        }
        parseWebReg();
        if (options.showCalendar && !currentURL.includes("/myKCal")) {
          insertCalendar();
        }
      } else {
        /*
         This is for courses.usc.edu, not web registration. Original version of the extension only worked
         here, then I realized it's useless and would be better suited for webreg
         */
        parseCoursePage(professorRatings);
      }
    }
  });
}

//Total spots is all lecture and lecture-lab spots (sum of 2nd # in "# of #"), avail able is first
let classTotalSpots = 0;
let classAvailableSpots = 0;
//This is for sections (such as BIO) which have classes that are labs only. Its the running total of ALL "# of #", but
// only displayed if isOnlyLabSections is true
let classTotalSpotsLabOnly = 0;
let classAvailableSpotsLabOnly = 0;
//This is for when a class is closed - it'll let you know how many spots are open based on discussion
let classDiscussionTotalSpots = 0;
let classDiscussionAvailableSpots = 0;
/*Initialize isOnlyLabSections to true - will get set to false if type of class is ever anything but Lab
 We are usually only interested in Lecture and Lecture-Lab, but some classes *only* have Labs - these are still interesting
 to Bio kids and whatnot. So we'll save all of them, and only display either the Lecture-ish ones or, if it's all Bio, then display totals
 */
let isOnlyLabSections = true;
//Checks whether all lecture sections are closed
let allLecturesClosed = false;
let classHasLectureSection = false;
let currentSectionHasDiscussion = false;
let currectSectionIsClosed = false;
//Url template for each professor
const ratingURLTemplate = "http://www.ratemyprofessors.com/ShowRatings.jsp?tid=";
//Contains a span HTML element, which is just included to insert a blank column cell in each row, to preserve spacing
const emptySpanCell = '<span class=\"instr_alt1 empty_rating col-xs-12 col-sm-12 col-md-1 col-lg-1\"><span \
class=\"hidden-lg hidden-md visible-xs-* visible-sm-* table-headers-xsmall\">Prof. Rating: </span></span>';
//An array that will contain the schedule that they are currently registered in
const currentScheduleArr = [];

function getCurrentSchedule() {
  //Pulls schedule from myCourseBin
  $.ajax({
    method: 'POST',
    url: "https://webreg.usc.edu/Scheduler/Read",
    type: 'text',
    success(data, textStatus, jqXHR) {
      parseSchedule(data);
    }
  });
}

function insertCalendar() {
  // Insert kendo css and js library
  $('body').append(`<link rel="stylesheet" href="${chrome.runtime.getURL("css/kendo.css")}" type="text/css" />`);
  $('body').append(`<link rel="stylesheet" href="${chrome.runtime.getURL("css/calendar.css")}" type="text/css" />`);
  $('body').append(`<script src="${chrome.runtime.getURL("js/libs/kendo.min.js")}"></script>`);
  //Construct the div containing the calendar
  let div = `<div id="popupCalendar" ><div id="popupCalendarHeader"><span id="popupCalText">Calendar (Alt key to toggle visibility, drag to move, Esc to close)</span><span id="shortCal">Cal</span></div><div style="display: none;" class="k-widget k-scheduler" id="scheduler"></div></div>`;
  $(".searchMargin").append(div);
  // Enable dragging around the header
  dragElement(document.getElementById(("popupCalendar")));
  $("#popupCalendar").hover(function () {
    $("#popupCalText").css('display', 'block');
    $("#popupCalText").addClass("isVis");
    $("#shortCal").hide();
  }, function () {
    $("#popupCalText").hide();
    $("#popupCalText").removeClass("isVis");
    $("#shortCal").show();

  });

  // Insert the js that has access to the window.kendo elements that deals with actually constructing the calendar
  $('body').append(`<script src="${chrome.runtime.getURL("js/calendar.js")}"></script>`);

}

function parseSchedule(data) {
  for (let singleClass of data.Data) {
    if (id == undefined) {
      id = singleClass.USCID;
    }
    var startTime = moment(parseInt(singleClass.Start.slice(6, -2)));
    var endTime = moment(parseInt(singleClass.End.slice(6, -2)));
    var classInfo = singleClass.Title.split(" ");
    const time = {
      "day": [startTime.format("dddd")],
      "time": [startTime.format('hh:mma'), endTime.format('hh:mma')],
      "section": classInfo[1].slice(1, -2),
      "classname": classInfo[0]
    };
    currentScheduleArr.push(time);
  }
  //Iterate over every div. The layout of webreg is alternating divs for class name/code and then its content
  $(".crs-accordion-content-area").each(function () {
    let doAllSectionsOverlap = true;
    const sections = $(this).find(".section_alt1, .section_alt0");

    sections.each(function () {

      //Get hours for current section
      let secHours = $(this).find("[class^=hours]")[0].innerText;
      secHours = secHours.replace("Time: ", '');
      secHours = secHours.split("-");
      //Get days for class for current section
      let secDays = $(this).find("[class^=days]")[0].innerText;
      secDays = secDays.replace("Days: ", '');
      secDays = splitDays(secDays);
      //Get section name to compare if you already have that class
      let secName = $(this).find("[class^=id]")[0].innerText;
      secName = secName.replace("Section: ", '');
      let didOverlap = false;
      //Get section name to compare if you already have that class
      let secType = $(this).find("[class^=type]")[0].innerText;
      secType = secType.replace("Type: ", '');
      let shouldBreak = false;
      /*Three nested for loops... Wow
       Kinda horrifying... but it works
       The saved schedule for classes currently in your course bin is currentScheduleArr
       It iterates over currentScheduleArr, then it iterates over every day in current schedule
       current schedule { day: ["M", "T", "Th"], time: ["08:00pm","11:00pm"], section: "33333"}
       Then it iterates over the current section (the specific class type per class, like discussion, lecture, etc)
       jQuery row object... I parsed secDays above, which would be like ["M", "T"]

       I need to filter it to only iterate over the intersection of the currentScheduleArr day and the current class
       day. Other than that, though, I can't see a more efficient solution.

       This will ideally not loop that many times, though - at most 5*5*(4)ish, if they're registered for 4 classes,
       and all 4 classes having MTWTHF classes. This is not likely though - on average, it'll loop 4*2*3.

       Performance trace tells us we only spend ~0.5 seconds on this function, so optimization is not currently needed
       */
      for (const currClass of currentScheduleArr) {
        if (shouldBreak || secName.startsWith(currClass.section)) {
          break;
        }
        for (let j = 0; j < currClass.day.length; j++) {
          if (shouldBreak) {
            break;
          }
          for (let k = 0; k < secDays.length; k++) {
            //Class already registered/scheduled
            const range = moment.range(moment(currClass.time[0], "hh:mma").day(currClass.day[j]), moment(currClass.time[1], "hh:mma").day(currClass.day[j]));
            const range2 = moment.range(moment(secHours[0], "hh:mma").day(secDays[k]), moment(secHours[1], "hh:mma").day(secDays[k]));
            if (range.overlaps(range2) && !secName.startsWith(currClass.section)) {
              shouldBreak = true;
              didOverlap = true;
              addConflictOverlay(this, currClass.classname);
            }
          }
        }
      }
      if (secType.startsWith("Lecture") && !didOverlap) {
        doAllSectionsOverlap = false;
      }
    });
    if (doAllSectionsOverlap) {
      insertAllOverlap(this);
    }
  });
  $(".warning").hover(function () {
    $(this).attr('value', 'Add Anyway');
  }, function () {
    var original = $(this).attr('orig_name');
    $(this).attr('value', original);
  });
}

//If the section it is currently parsing conflicts with a class in currentScheduleArr
function addConflictOverlay(row, name) {
  let addToCourseBin = $(row).find(".addtomycb");
  if (addToCourseBin.length !== 0) {
    $(row).css('background-color', 'rgba(255, 134, 47, 0.37)');
    addToCourseBin = addToCourseBin[0];
    $(addToCourseBin).attr('value', 'Overlaps ' + name);
    $(addToCourseBin).attr('orig_name', 'Overlaps ' + name);
    $(addToCourseBin).attr('title', 'This class overlaps with your current schedule!');
    $(addToCourseBin).addClass("warning");
  }
}

function splitDays(days) {
  //Split Thursday first because otherwise it'll get split on Tuesday
  let split = days.replace("Th", "D");
  split = split.split('');
  for (let i = 0; i < split.length; i++) {
    switch (split[i]) {
      case "M":
        split[i] = "Monday";
        break;
      case "T":
        split[i] = "Tuesday";
        break;
      case "W":
        split[i] = "Wednesday";
        break;
      case "D":
        split[i] = "Thursday";
        break;
      case "F":
        split[i] = "Friday";
        break;
    }
  }
  return split;
}

function insertExportButton() {
  const navbar = $("ul.nav");
  $(navbar).append("<li><a class=\"exportCal\" href=\"https://my.usc.edu/ical/?term=20183\">Export To Calendar</a></li>");
  const cals = $(".exportCal");
  $(cals[1]).remove();
}

function addPostRequests() {
  $(".notify").each(function () {
    const form = $(this)[0].form;
    $(this).attr('value', 'Notify Me');
    $(this).unbind();
    $(this).attr('type', 'button');
    $(this).unbind('mouseenter mouseleave');
    const id = $(form).find("#sectionid");
    // Try to extract department from form - USC isn't consistent in when they include the department;
    const department = $(form).find("#department").val();
    this.department = department;
    //get the department by matching form ID to the row above
    const formID = $(form).attr("id");
    const rowNum = formID.substring(4);
    const hrefMatch = `#course_${rowNum}`;
    const aboverow = $(`a[href="${hrefMatch}"]`);
    const courseSearch = $(aboverow).find(".crsID");
    let departmentFromAbove = "";
    if (courseSearch.length != 0) {
      const spanElem = $(courseSearch[0]).text();
      const departmentString = spanElem.split("-");
      departmentFromAbove = departmentString[0];
      if (departmentFromAbove) {
        this.department = departmentFromAbove;
      }
    }
    let titleTopbar = $(form).parents(".crs-accordion-content-area");
    if (titleTopbar) {
      let header = $(titleTopbar).prev();
      let crsId = $(header).find(".crsID");
      if (crsId && crsId.text()) {
        crsId = crsId.text().split("-");
        if (crsId[0]) {
          this.department = crsId[0];
        }
      }
    }
    const courseid = id.val();
    if (courseid == "65070") {
      console.log("hi");
    }
    $(this).click(() => {
      swal({
        title: 'Notify Me!',
        html: '<label> Email: </label> <input id="email" class="swal2-input">' + '<label> Phone number (optional, for text notifications only)</label><input id="phone" class="swal2-input">',
        preConfirm() {
          return new Promise(resolve => {
            resolve([$('#email').val(), $('#phone').val()]);
          });
        },
        onOpen() {
          $('#email').focus();
        },
        showCancelButton: true
      }).then(result => {
        let email = result[0];
        if (email) {
          email = email.trim();
        }
        let phone = result[1];
        // Try multiple ways of getting the department
        let department = $(form).find("#department").val();

        //If they got to this page by clicking on a specific course on myCourseBin, department won't be included in the
        // form, not sure why We do a hacky way by getting it from courseid
        if (!department) {
          let course = $(form).find("#courseid")[0];
          course = $(course).attr("value");
          if (course) {
            course = course.split("-");
            department = course[0];
          }
        }
        //Third way of getting the department, from above
        if (!department) {
          department = this.department;
        }
        if (phone === undefined) {
          phone = "";
        }
        if (department === "" || department === undefined) {
          errorModal(`Department in post request was null. Please contact jdecaro@usc.edu with a screenshot of this error!
Course: ${courseid}
Form: ${$(form).html()}
`);
          return;
        }
        if (email !== null && email !== "ttrojan@usc.edu" && validateEmail(email) && department !== "") {
          sendPostRequest(email, courseid, department, phone);
        } else {
          errorModal(`Error with email or department!`);
        }
      }).catch(swal.noop);
    });
  });
}

function validateEmail(email) {
  var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

function sendPostRequest(email, courseid, department, phone) {
  $.ajax({
    method: 'POST',
    url: "https://jonlu.ca/soc/notify",
    type: 'json',
    data: {
      email,
      courseid,
      department,
      phone,
      id
    },
    error(err) {
      console.log(err);
      if (err.status === 501) {
        errorModal("Error saving data! Please contact jdecaro@usc.edu with the class you are trying to register for.");
      } else if (err.status === 400) {
        errorModal("Invalid email!");
      } else {
        errorModal("An unknown error occurred! Please contact jdecaro@usc.edu with the class you are trying to register for.");
      }
    },
    success(data, textStatus, jqXHR) {
      if (textStatus === "success" && jqXHR.status === 200) {
        successModal("Sent verification email - please verify your email to begin receiving notifications! <br> \
                    <strong> It's probably in your spam folder!</strong> <br> \
                    Text message notifications have been disabled because they cost the developer too much to send. Email notifications will still work. <p style=\"font-size:12px\">If you want text notifications, venmo @JonLuca $1 with your email in the subject and I'll manually enable them for your account. </p> <br> If you have any questions, please contact jdecaro@usc.edu");
      }
      //If they've already verified their emails, the server returns 201
      //Don't show the message saying an email was sent
      if (textStatus === "success" && jqXHR.status === 201) {
        successModal("Text message notifications have been disabled because they cost the developer too much to send. Email notifications will still work. <p style=\"font-size:12px\">If you want text notifications, venmo @JonLuca $1 with your email in the subject and I'll manually enable them for your account. </p> <br> If you have any questions, please contact jdecaro@usc.edu");
      }
      //They've been ratelimited
      if (jqXHR.status === 429) {
        errorModal("You've been ratelimited! You are limited to 10 notifications in a 15 minute period. Please try again later");
      }
    }
  });
}

//Helper function to show pretty error messages
function errorModal(message) {
  swal('Error!', message, 'error');
}

//Helper function to show pretty success messages
function successModal(message) {
  swal('Success!', message, 'success');
}

//This extension adds a new column, thus squeezing a lot of the elements
//The following function renames the button from "Add to myCourseBin" to "Add" to preserve space
function changeAddToCourseBinButton(row) {
  let addToCourseBin = $(row).find(".addtomycb");
  if (addToCourseBin.length !== 0) {
    addToCourseBin = addToCourseBin[0];
    $(addToCourseBin).attr('value', 'Add');
  }
}

//Each row (which corresponds to a single lecture/lab/discussion time) needs to be parsed for times and spots available
function parseRegistrationNumbers(row) {
  //Find registration numbers for this row, formatted like "# of #". Hidden content also prepends it with Registered:
  // so that must be cut out
  const regNumElem = $(row).find(".regSeats_alt1, .regSeats_alt0");
  let regNum;
  //Cut out hidden text before it
  //If class has reg details
  if (regNumElem.length !== 0) {
    regNum = regNumElem[0].textContent.replace("Registered: ", "");
    //create array using "of" as delimiter
    regNum = regNum.split("of");
    if (regNum.length !== 2) {
      currectSectionIsClosed = true;
      if (regNum[0] !== null && regNum[0].trim() === "Closed" && !classHasLectureSection) {
        allLecturesClosed = true;
      }
      addNotifyMe(row);
      if (!$(row).hasClass("blank_rating")) {
        $(row).addClass("blank_rating");
        const loc = $(row).find('.instr_alt1, .instr_alt0')[0];
        $(loc).after(emptySpanCell);
      }
    } else {
      addRegistrationNumbers(row, regNum[0].trim(), regNum[1].trim());
    }
  }
}

//Any course that is full will get a Notify Me button, which allows users to type in their information and be notified
// if the class opens up again
function addNotifyMe(row) {
  let addToCourseBinButton = $(row).find(".addtomycb");
  if (addToCourseBinButton.length !== 0) {
    $(addToCourseBinButton[0]).after('<input name="submit" value="Notify Me" class="btn btn-default addtomycb col-xs-12 notify" type="button">');
  }
  ///If the class is already in their coursebin (doesn't mean they've registered for it, though - this fixes the edge
  // case that a lot of people have, in which they have a course in their coursebin and are just waiting for a spot to
  // open up)
  const alreadyInCourseBin = $(row).find(".alrdyinmycb");
  if (alreadyInCourseBin.length !== 0) {
    $(alreadyInCourseBin).replaceWith('<input name="submit" value="Notify Me" class="btn btn-default addtomycb col-xs-12" type="button">');
    let addToCourseBinAlready = $(row).find(".addtomycb");
    addToCourseBinAlready = addToCourseBinAlready[0];
    $(addToCourseBinAlready).attr('value', 'Notify Me');
    $(addToCourseBinAlready).removeAttr('type');
    $(addToCourseBinAlready).addClass("notify");
  }
}

// TODO: Fix this function, as it does too many things that are unrelated
function addRegistrationNumbers(row, enrolled, total) {
  //Gets each of ("# of #")
  //TODO: This utilizes global variables :( Sorry future person debugging this, I'll try to do a refactor before I
  // leave USC
  currentEnrolled = parseInt(enrolled);
  totalAvailable = parseInt(total);
  //Checks class type - we are only interested in Lecture and Lecture-Lab
  const classTypeElem = $(row).find('.type_alt1, .type_alt0');
  let classType;
  if (classTypeElem.length !== 0) {
    classType = classTypeElem[0].textContent;
    parseClassType(row, classType);
  }
}

// Parses each row for what type of class it is, and whether there are still spots
function parseClassType(row, classType) {
  //If it's not a lab or quiz
  if (classType === "Type: Lecture" || classType === "Type: Lecture-Lab" || classType === "Type: Lecture-Discussion") {
    //It's not a lab, so isOnlyLabSections is false
    isOnlyLabSections = false;
    classHasLectureSection = true;
    classTotalSpots += totalAvailable;
    classAvailableSpots += (totalAvailable - currentEnrolled);
    allLecturesClosed = false;
    // If the class is closed, insert the Notify Me button
    if (classAvailableSpots === 0) {
      addNotifyMe(row);
    }
  } else if (classType === "Type: Lab") {
    classTotalSpotsLabOnly += totalAvailable;
    classAvailableSpotsLabOnly += (totalAvailable - currentEnrolled);
  } else if (classType === "Type: Discussion") {
    isOnlyLabSections = false;
    currentSectionHasDiscussion = true;
    classDiscussionTotalSpots += totalAvailable;
    classDiscussionAvailableSpots += (totalAvailable - currentEnrolled);
  } else {
    //If not Lab or Lecture/lecture-lab then set the flag to false
    isOnlyLabSections = false;
  }
}

function insertBlankRatingCell(row) {
  //blank rating is if you can not find the professor in the json - we still need something in that cell
  //Looking back it might be better if I add the cell in before hand no matter what, and then only change it's inner
  // html if it's a valid professor... TODO refactor for next semester I suppose
  if (!$(row).hasClass("blank_rating")) {
    $(row).addClass("blank_rating");
    const loc = $(row).find('.instr_alt1, .instr_alt0')[0];
    $(loc).after(emptySpanCell);
  }
}

function insertProfessorRating(row, professor_info) {
  const url = ratingURLTemplate + professor_info.id;
  //To prevent reinserting, or if there are multiple professors, we insert an anchor with a rating class
  //if there already is one then we know it's another professor
  if ($(row).find('.rating').length !== 0) {
    $(row).find('.rating').after(`, <a href=${url}>Link</a>`);
  } else {
    $(row).addClass("blank_rating");
    //long string but needs to be exactly formatted
    const location_of_insert = $(row).find('.instr_alt1, .instr_alt0')[0];
    //actual contents of rating
    let rating_anchor = `<a class="rating" href=${url} target="_blank">Link</a>`;
    // If you want the rating on the page, just delete the string above and rename the one below this comment to
    // rating_anchor
    const rating_anchor_with_score = `<a class="rating" href=${url} target="_blank">${professor_info.rating}</a>`;
    if (options.showRatings) {
      rating_anchor = rating_anchor_with_score;
    }
    //long string just to include new
    $(location_of_insert).after(`<span class="hours_alt1 text-md-center col-xs-12 col-sm-12 col-md-1 col-lg-1"><span class="hidden-lg hidden-md hidden-visible-xs-* visible-sm-* table-headers-xsmall">Prof. Rating: </span>${rating_anchor}</span>`);
    /* Very specific edge case - if you have two professors and you could not find the first, it'll insert an empty cell. However, if you can
     find the second you still want his score to be visible, so we need to remove the previously inserted blank one */
    if ($(row).find(".empty_rating").length !== 0) {
      $(row).find(".empty_rating")[0].remove();
    }
  }
}

function parseRows(rows) {
  $(rows).each(function () {
    //rename Add to myCourseBin button so that it fits/looks nice
    changeAddToCourseBinButton(this);
    parseRegistrationNumbers(this);
    //Retrieve Instructor cell from row
    const instructor_name_element = $(this).find(".instr_alt1, .instr_alt0");
    if (instructor_name_element.length === 0) {
      //I don't think this code actually ever runs, as USC creates blank cells with that class if it's empty, but
      // better safe than sorry here. If in the future they change it this'll prevent it from looking misaligned
      insertBlankRatingCell(this);
      //jQuery way of saying continue;
      return true;
    }
    //get all professor names in a hacky way
    const instructor_names = instructor_name_element[0].innerHTML.split("span>");
    //split on line breaks
    const instructor_name = instructor_names[1].split("<br>");
    //if there are multiple instructors
    for (const name of instructor_name) {
      //single instructor name, comma delimited
      parseProfessor(name, this);
    }
  });
}

function parseProfessor(instructor, row) {
  if (instructor.trim() === "" && !$(row).hasClass("blank_rating")) {
    $(row).addClass("blank_rating");
    const location_of_insert = $(row).find('.instr_alt1, .instr_alt0')[0];
    $(location_of_insert).after(emptySpanCell);
  }
  let actual_name = instructor.split(", ");
  //generate actual name
  actual_name = `${actual_name[1]} ${actual_name[0]}`;
  //If instructor name in json
  if (actual_name in professorRatings) {
    insertProfessorRating(row, professorRatings[actual_name]);
  } else {
    insertBlankRatingCell(row);
  }
}

function insertProfRatingHeader(header) {
  const days = $(header).find(".instr_alt1, .instr_alt0")[0];
  $(days).after("<span class=\"instr_alt1 col-md-1 col-lg-1\"><b>Prof. Rating</b></span>");
}

// Resets global variables to 0. Ideally I'd refactor this to not have any globs, but the project started small and
// just grew
function reinitializeVariablesPerClass() {
  //reinit to 0
  classTotalSpots = 0;
  classAvailableSpots = 0;
  //keeps track of all counts in case it's an all-lab scenario
  classTotalSpotsLabOnly = 0;
  classAvailableSpotsLabOnly = 0;
  classDiscussionTotalSpots = 0;
  classDiscussionAvailableSpots = 0;
  isOnlyLabSections = true;
  //Checks whether all lecture sections are closed
  allLecturesClosed = false;
  //If it has ANY lecture sections
  classHasLectureSection = false;
  currentSectionHasDiscussion = false;
  //Is the current class closed for registration?
  currectSectionIsClosed = false;
}

function insertTotalSpots(element) {
  const nameElem = $(element).prev();
  const name = $(nameElem).find('.course-title-indent');
  let spotsRemainingString = `<span class="crsTitl spots_remaining"> - ${classAvailableSpots}`;
  if (classAvailableSpots === 1) {
    spotsRemainingString += " spot remaining" + "</span>";
  } else {
    spotsRemainingString += " spots remaining" + "</span>";
  }
  name.append(spotsRemainingString);
  //Let's make the background red if no spots remaining
  if (classAvailableSpots === 0) {
    $(name).css("background-color", "rgba(240, 65, 36, 0.45)");
  }
}

function insertClosedRegistration(element) {
  const nameElem = $(element).prev();
  const name = $(nameElem).find('.course-title-indent');
  if (currentSectionHasDiscussion) {
    name.append(`<span class="crsTitl spots_remaining"> - closed registration ( ${classDiscussionAvailableSpots} spots remaining)</span>`);
  } else {
    name.append("<span class=\"crsTitl spots_remaining\">" + " - closed registration</span>");
  }
  //Let's make the background red if no spots remaining
  $(name).css("background-color", "rgba(240, 65, 36, 0.45)");
}

function insertOnlyLabNumbers(element) {
  const nameElem = $(element).prev();
  const name = $(nameElem).find('.course-title-indent');
  name.append(`<span class="crsTitl spots_remaining"> - ${classAvailableSpotsLabOnly} remaining lab spots</span>`);
  if (classAvailableSpotsLabOnly === 0) {
    $(name).css("background-color", "rgba(240, 65, 36, 0.45)");
  }
}

function insertAllOverlap(element) {
  const nameElem = $(element).prev();
  const name = $(nameElem).find('.course-title-indent');
  //Let's make the background orange if all lectures overlap
  let color = $(name).css('background-color');
  if (color == "rgba(240, 65, 36, 0.45)") {
    $(name).css("background", "linear-gradient(to right, rgba(240, 65, 36, 0.45) , rgba(255, 134, 47, 0.37))");
  } else {
    $(name).css("background-color", "rgba(255, 134, 47, 0.37)");
  }
}

function insertClassNumbers(element) {
  //Normal insert for remaining spots
  if (classTotalSpots !== 0 && isNumber(classTotalSpots)) {
    insertTotalSpots(element);
  }
  //If it's closed
  if (allLecturesClosed && !classHasLectureSection) {
    insertClosedRegistration(element);
  }
  //if there were only labs in this class, show it
  if (isOnlyLabSections && classTotalSpotsLabOnly !== 0 && isNumber(classTotalSpotsLabOnly)) {
    insertOnlyLabNumbers(element);
  }
}

function addUnitsToTitle(row) {
  if (options.showUnits) {
    // get units
    let units = $(row).find("[class^=type_alt]");

    // 3 is because the header has two elements that start with type_alt
    if (units.length > 3) {
      let actualUnits = $(units)[3].innerText;
      actualUnits = actualUnits.replace("Units: ", "");
      // start at 5 because every row has 2 elements with class ^= type_alt - also increment by 2
      var nextRowToCheckForNonZeroUnits = 5;

      // Edge case for when the first class in web reg is not the discussion section one, and doesn't have the right
      // unit value
      while (actualUnits && actualUnits.trim() == "0.0" && nextRowToCheckForNonZeroUnits < units.length) {
        actualUnits = $(units)[nextRowToCheckForNonZeroUnits].innerText;
        actualUnits = actualUnits.replace("Units: ", "");
        nextRowToCheckForNonZeroUnits += 2;
      }
      let header = $(row).prev();
      let headerText = $(header).find('.course-title-indent');
      const unitText = `<span class="crsTitl spots_remaining"> - ${actualUnits} units</span>`;
      $(headerText).append(unitText);
    }
  }
}

function parseClass(classes) {
  $(classes).each(function () {
    addUnitsToTitle(this);

    //set global variables to 0 (counts, class closed, class type, etc)
    reinitializeVariablesPerClass();
    //Insert Prof Rating column at top of each class view
    const header = $(this).find(".section_head_alt1, .section_alt0");
    insertProfRatingHeader(header);
    //Iterate over every section in row. To get alternating colors, USC uses alt0 and alt1, so we must search for both
    const sections = $(this).find(".section_alt1, .section_alt0");
    parseRows(sections);
    //If total spots is a number and it's not 0, insert
    insertClassNumbers(this);
  });
}

function changeCSSColumnWidth() {
  //Sets CSS of page to display everything correctly
  $(".rm_alt1").css({
    "width": "4%"
  });
  $(".btnAddToMyCourseBin_alt1").css({
    "width": "12%",
    "float": "right"
  });
  $(".rm_alt0").css({
    "width": "4%"
  });
  $(".btnAddToMyCourseBin_alt0").css({
    "width": "12%",
    "float": "right"
  });
  $(".session_alt1").css({
    "width": "4%"
  });
  $(".session_alt0").css({
    "width": "4%"
  });
  $(`<style type='text/css'>
      @media (min-width: 992px) {
          .text-md-center {
              text-align: center;
          }
      }
     </style>`).appendTo("head");
}

function parseWebReg() {
  //Because we insert a new column, we need to change the CSS around to make it look right
  changeCSSColumnWidth();
  //Iterate over every div. The layout of webreg is alternating divs for class name/code and then its content
  const individualClass = $(".crs-accordion-content-area");
  //Parses each class found previously
  parseClass(individualClass);
  addPostRequests();
}

//Credit to http://stackoverflow.com/questions/8525899/how-to-check-if-a-javascript-number-is-a-real-valid-number
//Checks if a number is valid
function isNumber(n) {
  return typeof n === 'number' && !isNaN(n) && isFinite(n);
}

function parseCoursePage(professorRatings) {
  //Get all courses
  const courses = $(".course-info");
  let totalSpots = 0;
  let availSpots = 0;
  const ratingTemplate = "http://www.ratemyprofessors.com/ShowRatings.jsp?tid=";
  //Iterate over courses on page
  for (let i = 0; i < courses.length; i++) {
    totalSpots = 0;
    availSpots = 0;
    //Get table with jQuery selector
    const table = $(courses[i]).find("> .course-details > table.sections");
    //Get rows, iterate over each one
    $(table[0]).find("> tbody > tr").each(function () {
      if ($(this).hasClass("headers")) {
        //create new column
        $(this).find('.instructor').after('<th>Prof. Rating</th>');
        //jQuery's version of continue
        return true;
      }
      //find Type column
      let type = $(this).find("td.type");
      if (type.length !== 0) {
        type = type[0].textContent;
      } else {
        return true;
      }
      //Get registration numbers
      const registratioNumbers = $(this).find("td.registered")[0].textContent.split(" of ");
      const currentlyEnrolled = parseInt(registratioNumbers[0]);
      const totalAvailable = parseInt(registratioNumbers[1]);
      //If it's not a lab or quiz
      if (type === "Lecture" || type === "Lecture-Lab") {
        totalSpots += totalAvailable;
        availSpots += (totalAvailable - currentlyEnrolled);
      }
      const professor = $(this).find("td.instructor")[0];
      //Professor names are separated by commas, so this handles the case that multiple profs teach a section
      const profName = professor.textContent.split(",");
      for (let i = 0; i < profName.length; i++) {
        splitProfName = profName[i];
        //Names are formatted "First Last" so no reordering is necessary
        //However, some names are "First Middle Middle2 Last", and we only want "First Last" as that is the format of
        // our json
        let name = splitProfName.split(" ");
        name = `${name[0]} ${name[name.length - 1]}`;
        //If its in JSON
        if (name in professorRatings) {
          //generate RMP URL
          const url = ratingTemplate + professorRatings[name].id;
          //If we've never inserted before, insert. Otherwise insert with a comma before it for good formatting
          if ($(this).find('.rating').length === 0) {
            if (options.showRatings) {
              $(this).find('td.instructor').after(`<td class="rating"><a href=${url} target="_blank">${professorRatings[name].rating}</a></td>`);

            } else {
              $(this).find('td.instructor').after(`<td class="rating"><a href=${url} target="_blank">Link</a></td>`);
            }
          } else {
            $(this).find('.rating').append(`, <a href=${url}>${professorRatings[name].rating}</a>`);
          }
        } else {
          //If not in JSON, we need an empty space to make table format correctly
          if ($(this).find('.rating').length === 0) {
            $(this).find('td.instructor').after('<td class="rating"> </td>');
          } else {
            $(this).find('.rating').append(' ');
          }
        }
      }
    });
    //insert remaining spots in main
    const title = $(courses[i]).find("> .course-id > h3 > a");
    if (totalSpots !== 0 && isNumber(totalSpots)) {
      let availableString = ` - ${availSpots} remaining spot`;
      if (availSpots > 1) {
        availableString += "s";
      }
      if (availSpots === 0) {
        availableString += "s";
        const background = $(courses[i]).find("> .course-id");
        $(background).css("background-color", "rgba(240, 65, 36, 0.45)");
      }
      title.append(availableString);
    }
  }
}

//Draggable element code from https://www.w3schools.com/howto/howto_js_draggable.asp
function dragElement(elmnt) {
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  if (document.getElementById(elmnt.id + "Header")) {
    /* if present, the header is where you move the DIV from:*/
    document.getElementById(elmnt.id + "Header").onmousedown = dragMouseDown;
  } else {
    /* otherwise, move the DIV from anywhere inside the DIV:*/
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    /* stop moving when mouse button is released:*/
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function preventEventChng(e) {
  let prevent = ["YN", "YY", "NY", "NN", "YN*", "YY*", "NY*", "NN*"];
  let scheduled = e.event.Scheduled;
  if (prevent.indexOf(scheduled) != -1) {
    setTimeout(function () {
    }, 0);
    e.preventDefault();
  }

  if (e.event.Scheduled == "Block") {
    setTimeout(function () {
    }, 0);
    $('.k-window-title').text("Block Time");
  }

  if (e.event.Scheduled == "") {
    setTimeout(function () {
    }, 0);
    $('.k-window-title').text("Block Time");
  }

}