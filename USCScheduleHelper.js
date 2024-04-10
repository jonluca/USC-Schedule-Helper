let professorRatings = new Map();
let options;
let id;
let textsEnabled = undefined;
chrome.runtime.onMessage.addListener(onMessage);
let venmoImage = chrome.runtime.getURL("images/venmo.png");
let venmoQrImage = chrome.runtime.getURL("images/venmo-qr.jpeg");

function onMessage(message, sender, sendResponse) {
  if (message.action === "optionsChanged") {
    options = message.options;
  }
}

$(() => {
  loadOptions((receivedOptions) => {
    options = receivedOptions;
    if (receivedOptions.extensionEnabled) {
      startHelper();
    }
  });
});

function getCleanName(name) {
  return name.toLowerCase().replace(/[^a-zA-Z]/gi, "");
}

async function startHelper() {
  //Pages URL
  const currentURL = window.location.href;
  if (currentURL.includes("webreg")) {
    //Insert "Export to Calendar" button in nav bar
    insertExportButton();
  }
  //This loads the JSON of all the professors, rating, and unique ID. Only way I've found to get it, unfortunately, is
  // through a HTTPRequest Typically loads in ~40ms, so not a huge issue, I just wish there was a more efficient way of
  // doing it
  const response = await fetch(chrome.runtime.getURL("data/ratings.json"));
  const data = await response.json();
  let ratings = data;
  if (typeof data === "string") {
    ratings = JSON.parse(data);
  }
  for (const professor of ratings) {
    const nameClean = getCleanName(
      `${professor.firstName} ${professor.lastName}`
    );
    const professorsEntryForName = professorRatings.get(nameClean) || [];
    professorsEntryForName.push(professor);
    professorRatings.set(nameClean, professorsEntryForName);
  }
  //If we are on webreg or if we're on classes.usc.edu
  if (currentURL.includes("webreg") && !currentURL.includes("/myCourseBin")) {
    //Appending to body makes the stylesheet async
    $("body").append(
      `<link rel="stylesheet" href="${chrome.runtime.getURL(
        "css/sweetalert.css"
      )}" type="text/css" />`
    );
    if (options.showConflicts) {
      getCurrentSchedule();
    }
    parseWebReg();
    // if (
    //   options.showCalendar &&
    //   !currentURL.includes("/myKCal") &&
    //   !currentURL.includes("/Calendar")
    // ) {
    //   insertCalendar();
    // }
  } else {
    /*
                 This is for courses.usc.edu, not web registration. Original version of the extension only worked
                 here, then I realized it's useless and would be better suited for webreg
                 */
    parseCoursePage();
  }
}

/*
 * TODO(jonluca) Refactor out globals and have tighter coupling within functions
 *
 * Each global should have minimum viable scope attached.
 *
 * Attempt to change class iteration into mapping functions
 * */
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
const ratingURLTemplate = "https://www.ratemyprofessors.com/professor/";
//Contains a span HTML element, which is just included to insert a blank column cell in each row, to preserve spacing
const emptySpanCell =
  '<span class="instr_alt1 empty_rating col-xs-12 col-sm-12 col-md-1 col-lg-1"><span \
    class="hidden-lg hidden-md visible-xs-* visible-sm-* table-headers-xsmall">Prof. Rating: </span></span>';
//An array that will contain the schedule that they are currently registered in
const currentScheduleArr = [];

async function getCurrentSchedule() {
  const data = await fetch("https://webreg.usc.edu/Calendar");
  const text = await data.text();
  const syncScript = text.split("<script>kendo.syncReady")[1]?.split("\n")[0];
  if (!syncScript) {
    return;
  }
  // there's a json object of the form "data":{"Data" that we want to parse
  const json = syncScript.split('data":{"Data":')[1]?.split("]")[0];
  if (json) {
    const dataObject = JSON.parse(`{"Data":${json}]}`);
    parseSchedule(dataObject);
  }
}

// function insertCalendar() {
//   // Insert kendo css and js library
//   $("body").append(
//     `<link rel="stylesheet" href="${chrome.runtime.getURL(
//       "css/kendo.css"
//     )}" type="text/css" />`
//   );
//   $("body").append(
//     `<link rel="stylesheet" href="${chrome.runtime.getURL(
//       "css/calendar.css"
//     )}" type="text/css" />`
//   );
//   $("body").append(
//     `<script src="${chrome.runtime.getURL("js/libs/kendo.min.js")}"></script>`
//   );
//   //Construct the div containing the calendar
//   let div = `<div id="popupCalendar" ><div id="popupCalendarHeader"><span id="popupCalText">Calendar (Alt key to toggle visibility, drag to move, Esc to close)</span><span id="shortCal">Cal</span></div><div style="display: none;" class="k-widget k-scheduler" id="scheduler"></div></div>`;
//   $(".searchMargin").append(div);
//   // Enable dragging around the header
//   dragElement(document.getElementById("popupCalendar"));
//   $("#popupCalendar").hover(
//     () => {
//       $("#popupCalText").css("display", "block");
//       $("#popupCalText").addClass("isVis");
//       $("#shortCal").hide();
//     },
//     () => {
//       $("#popupCalText").hide();
//       $("#popupCalText").removeClass("isVis");
//       $("#shortCal").show();
//     }
//   );
//
//   // Insert the js that has access to the window.kendo elements that deals with actually constructing the calendar
//   $("body").append(
//     `<script src="${chrome.runtime.getURL("js/calendar.js")}"></script>`
//   );
// }

function convertTZ(date, tzString) {
  return new Date(date).toISOString("en-US", { timeZone: tzString });
}

function hoursToPSTMoment(hours) {
  const dateObj = convertTZ(hours, "America/Los_Angeles");
  return moment(dateObj);
}

function parseSchedule(data) {
  if (!data || !data.Data || !data.Data.length) {
    return;
  }
  for (let singleClass of data.Data) {
    if (!id) {
      id = singleClass.USCID;
    }
    const startTime = moment(singleClass.Start);
    const endTime = moment(singleClass.End);
    const classInfo = singleClass.Title.split(" ");
    const time = {
      day: [startTime.format("dddd")],
      time: [startTime.format("hh:mma"), endTime.format("hh:mma")],
      section: classInfo[1].slice(1, -2),
      classname: classInfo[0],
    };
    currentScheduleArr.push(time);
  }
  //bail if no classes
  if (currentScheduleArr.length === 0) {
    return;
  }
  //Iterate over every div. The layout of webreg is alternating divs for class name/code and then its content
  $(".accordion-content-area").each(function () {
    let doAllSectionsOverlap = true;
    const sections = $(this).find(".section");

    sections.each(function () {
      try {
        const rows = $(this).find(".section_row").toArray();
        //Get hours for current section
        let secHours = rows.find((r) =>
          r.innerText.includes("Time:")
        )?.innerText;
        secHours = secHours?.replace("Time: ", "")?.trim();
        secHours = secHours?.split("-");
        //Get days for class for current section
        let secDays = rows.find((r) =>
          r.innerText.includes("Days:")
        )?.innerText;
        secDays = secDays?.replace("Days: ", "")?.trim();
        secDays = splitDays(secDays);
        //Get section name to compare if you already have that class
        let secName = rows.find((r) =>
          r.innerText.includes("Section:")
        )?.innerText;
        secName = secName?.replace("Section: ", "")?.trim();
        //Get section name to compare if you already have that class
        let secType = rows.find((r) =>
          r.innerText.includes("Type:")
        )?.innerText;
        secType = secType?.replace("Type: ", "")?.trim();
        for (const currClass of currentScheduleArr) {
          if (secName.startsWith(currClass.section)) {
            continue;
          }
          for (const currClassDay of currClass.day) {
            const secDay = secDays.find((d) => d === currClassDay);
            if (!secDay) {
              continue;
            }
            //Class already registered/scheduled
            const start = moment(currClass.time[0], "hh:mma");
            const end = moment(currClass.time[1], "hh:mma");
            const range = moment.range(start, end);

            const start2 = moment(secHours[0], "hh:mma");
            const end2 = moment(secHours[1], "hh:mma");
            const range2 = moment.range(start2, end2);
            if (range.overlaps(range2)) {
              addConflictOverlay(this, currClass.classname);
              return;
            }
          }
        }
        if (secType.startsWith("Lecture")) {
          doAllSectionsOverlap = false;
        }
      } catch (e) {
        console.error(e);
      }
    });
    if (doAllSectionsOverlap) {
      insertAllOverlap(this);
    }
  });
  $(".warning").hover(
    function () {
      // if it has the notify class, set the value to "Notify Me"
      const text = $(this).hasClass("notify") ? "Notify Me" : "Add Anyway";
      $(this).attr("value", text);
      $(this).text(text);
    },
    function () {
      const original = $(this).attr("orig_name");
      $(this).attr("value", original);
      $(this).text(original);
    }
  );
}

//If the section it is currently parsing conflicts with a class in currentScheduleArr
function addConflictOverlay(row, name) {
  let addToCourseBin = $(row).find(".addtomycb, .add-to-course-bin");
  if (addToCourseBin.length !== 0) {
    $(row).css("background-color", "rgba(255, 134, 47, 0.37)");
    $($(row).children()[0]).css("background-color", "rgba(255, 134, 47, 0.37)");
    addToCourseBin = addToCourseBin[0];
    $(addToCourseBin).attr("value", `Overlaps ${name}`);
    // set text content of the button to "Overlaps with [class name]"
    $(addToCourseBin).text(`Overlaps ${name}`);
    $(addToCourseBin).attr("orig_name", `Overlaps ${name}`);
    $(addToCourseBin).attr("title", `This class overlaps with ${name}!`);
    $(addToCourseBin).addClass("warning");
  }
}

function splitDays(days) {
  if (!days) {
    return [];
  }
  //Split Thursday first because otherwise it'll get split on Tuesday
  let split = days.replace("Th", "D");
  split = split.split("");
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
  $(navbar).append(
    '<li><a class="exportCal" href="https://my.usc.edu/ical/?term=20191">Export To Calendar</a></li>'
  );
  const cals = $(".exportCal");
  $(cals[1]).remove();
}

Mailcheck.defaultDomains.push("usc.edu", "yahoo.com"); // extend existing domains
Mailcheck.defaultTopLevelDomains.push("edu"); // extend existing TLDs
async function checkEmail(email) {
  return new Promise((resolve) => {
    Mailcheck.run({
      email: email,
      suggested: function (suggestion) {
        resolve(suggestion);
      },
      empty: function () {
        resolve(null);
      },
    });
  });
}

function addPostRequests() {
  $(".notify").each(function () {
    const form = $(this)[0].form;
    $(this).attr("value", "Notify Me");
    $(this).unbind();
    $(this).attr("type", "button");
    $(this).unbind("mouseenter mouseleave");
    let strings = form.attributes["data-ajax-url"]?.textContent.split("/");
    let id = strings?.[4];
    if (!id) {
      // try and find the id from the parent
      const parent = $(this).closest(".section_crsbin");
      if (parent) {
        const rows = $(parent).find(".section_row").toArray();
        const sectionRow = rows.find((r) => r.innerText.includes("Section"));
        if (sectionRow) {
          // replace any non number characters
          const section = sectionRow.innerText.replace(/\D/g, "");
          if (section) {
            id = section;
          }
        }
      }
    }
    if (!id) {
      console.warn("No id found for notify button, skipping.");
      return true;
    }
    let titleTopbar = $(form).parents(".accordion-content-area");
    let header = $(titleTopbar).prev();
    //get the department by matching form ID to the row above
    const courseSearch = $(header).find(".crsID");
    let departmentFromAbove = "";
    if (courseSearch.length) {
      const spanElem = $(courseSearch[0]).text();
      const departmentString = spanElem.split("-");
      departmentFromAbove = departmentString[0];
      if (departmentFromAbove) {
        this.department = departmentFromAbove;
      }
    }

    let fullCourseId;
    if (titleTopbar) {
      let header = $(titleTopbar).prev();
      fullCourseId = $(header).find(".crsID");
      let text = fullCourseId.text();
      if (fullCourseId && text) {
        const splitcrsId = text.split("-");
        fullCourseId = text.split(" ")[0];
        if (splitcrsId[0]) {
          this.department = splitcrsId[0];
        }
      }
    }
    const courseid = id;
    $(this).click(async () => {
      let currentDepartmentYearText = "";
      try {
        const topNav = $("nav").find('[href="/Departments"]');
        if (topNav) {
          currentDepartmentYearText = topNav.text().trim().toLocaleLowerCase();
        }
      } catch (e) {
        // do nothing
      }

      // we don't watch classes in summer
      if (currentDepartmentYearText.includes("summer")) {
        alert(
          "We currently do not support notifications for summer classes, sorry"
        );
        return;
      }
      try {
        let defaultValue = "";
        let localStorageEmailKey = "uscScheduleHelperEmail";
        let localStoragePhoneKey = "uscScheduleHelperPhone";
        try {
          defaultValue = localStorage.getItem(localStorageEmailKey) || "";
        } catch (e) {
          console.error(e);
        }
        let response = await Swal.fire({
          title: "Email",
          input: "email",
          type: "question",
          showCancelButton: true,
          inputValue: defaultValue,
        });

        if (!response || !response.value) {
          return;
        }
        let email = response.value.trim().toLowerCase();

        const suggested = await checkEmail(email);

        if (suggested) {
          let emailSuggestion = await Swal.fire({
            title: "Possible incorrect email",
            html: `The email you entered is ${email}.<br /> Did you mean <b>${suggested.full}</b>?`,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: `Yes`,
            denyButtonText: `No (use my original email)`,
          });
          if (emailSuggestion.isConfirmed) {
            email = (suggested.full || "").trim().toLowerCase();
          }
          if (emailSuggestion.isDismissed) {
            return;
          }
        }
        try {
          localStorage.setItem(localStorageEmailKey, email);
        } catch (e) {
          console.error(e);
        }
        let defaultPhoneValue = "";

        try {
          defaultPhoneValue = localStorage.getItem(localStoragePhoneKey) || "";
        } catch (e) {
          console.error(e);
        }
        if (textsEnabled === undefined) {
          try {
            const data = await fetch("https://jonlu.ca/soc/texts-enabled", {
              method: "GET",
              headers: {
                accept: "application/json",
              },
            });
            const response = await data.json();
            textsEnabled = response.enabled;
          } catch (e) {
            console.error(e);
          }
        }
        let phone = "";
        if (textsEnabled) {
          let phoneResponse = await Swal.fire({
            title: "Phone number",
            cancelButtonText: `Skip`,
            html: `If you'd like texts in addition to emails, add your phone number here (costs $1 per section per semester) - optional. <input id="phone" placeholder="2135559020" value="${defaultPhoneValue}" class="swal2-input">`,
            preConfirm() {
              return new Promise((resolve) => {
                resolve($("#phone").val());
              });
            },
            onOpen() {
              $("#phone").focus();
            },
            showCancelButton: true,
          });
          phone = (phoneResponse && phoneResponse.value) || "";
          if (phone) {
            try {
              localStorage.setItem(localStoragePhoneKey, phone);
            } catch (e) {
              console.error(e);
            }
          }
        }
        // Try multiple ways of getting the department
        let department = $(form).find("#department").val();

        //If they got to this page by clicking on a specific course on myCourseBin, department won't be included in the
        // form, not sure why We do a hacky way by getting it from courseid
        if (!department) {
          let course = $(form).find("#courseid")[0];
          if (course) {
            course = $(course).attr("value");
            if (course) {
              course = course.split("-");
              department = course[0];
            }
          }
        }
        //Third way of getting the department, from above
        if (!department) {
          department = this.department;
        }

        if (department === "" || department === undefined) {
          errorModal(`Department in post request was null. Please contact jdecaro@usc.edu with a screenshot of this error!
Course: ${courseid}
Form: ${$(form).html()}
`);
          return;
        }

        sendPostRequest(email, courseid, fullCourseId, department, phone);
      } catch (e) {
        console.error(e);
      }
    });
  });
}

function sendPostRequest(email, courseid, fullCourseId, department, phone) {
  let semester = "";
  try {
    const termTab = document.getElementById("activeTermTab");
    if (termTab) {
      const [term, year] = termTab.textContent.trim().toLowerCase().split(" ");
      if (year && ["fall", "spring"].includes(term)) {
        semester = `${year}${term === "fall" ? "3" : "1"}`;
      }
    }
  } catch (e) {
    console.error(e);
  }
  $.ajax({
    method: "POST",
    url: "https://jonlu.ca/soc/notify",
    type: "json",
    data: {
      email,
      courseid,
      department,
      phone,
      id,
      semester,
      fullCourseId,
    },
    error(err) {
      console.log(err);
      if (err.status === 501) {
        errorModal(
          "Error saving data! Please contact jdecaro@usc.edu with the class you are trying to register for."
        );
      } else if (err.status === 400) {
        const message =
          (err.responseJSON && err.responseJSON.error) || "Invalid email";
        errorModal(message);
      } else {
        errorModal(
          "An unknown error occurred! Please contact jdecaro@usc.edu with the class you are trying to register for."
        );
      }
    },
    success(data, textStatus, { status }) {
      if (textStatus === "success") {
        let textNotif = `Email: <b>${data.email}</b><br>${
          data.phone && `Phone: <b>${data.phone}</b><br>`
        }<br>`;
        // server returns a 200 if they've never signed up/verified their email, and a 201 if they have. If they
        // haven't, show email verification notice
        if (status === 200) {
          textNotif +=
            "Sent verification email - please verify your email to begin receiving notifications! <br> \
                                            <strong> It's probably in your spam folder!</strong>";
        }

        const link = `<a href=venmo://paycharge?txn=pay&recipients=JonLuca&amount=1&note=${
          data.section && data.section.rand
        }>You can also copy and paste this link to auto open Venmo with the right fields.</a>`;

        if (data.isPaidAlready || true) {
          textNotif += `<br><br>You've already paid for this section! You'll receive notifications when a spot opens up. If you think this is in error, reach out to help@jonlu.ca`;
        } else {
          textNotif +=
            (data.phone &&
              textsEnabled &&
              `<br><br>To get text notifications, Venmo @JonLuca $1 with the following 8 numbers in the note section:<br><br><b style="font-size: 18px;">${
                data.section && data.section.rand
              }</b><br><br> <strong>Your venmo should look exactly like the image below, with nothing else. If it asks for a last 4 digits of the phone number, use 9020</strong><div id="venmo-image"><img src="${venmoImage}"/><img src="${venmoQrImage}"/><span class="randSectionId">${
                data.section && data.section.rand
              }</span><br>${link}</div>`) ||
            "";
        }

        textNotif +=
          '<br><br>If you have any questions, please reach out to <a href="mailto:jdecaro@usc.edu">jdecaro@usc.edu</a>';
        successModal(textNotif);
      }
      //They've been ratelimited
      if (status === 429) {
        errorModal(
          "You've been ratelimited! You are limited to 10 notifications in a 15 minute period. Please try again later"
        );
      }
    },
  });
}

//Helper function to show pretty error messages
function errorModal(message) {
  Swal.fire("Error!", message, "error");
}

//Helper function to show pretty success messages
function successModal(message) {
  Swal.fire("Success!", message, "success");
}

//This extension adds a new column, thus squeezing a lot of the elements
//The following function renames the button from "Add to myCourseBin" to "Add" to preserve space
function changeAddToCourseBinButton(row) {
  let addToCourseBin = $(row).find(".addtomycb, .add-to-course-bin");
  // filter out any with the notify class
  addToCourseBin = addToCourseBin.filter((i, el) => !$(el).hasClass("notify"));
  if (addToCourseBin.length !== 0) {
    addToCourseBin = addToCourseBin[0];
    $(addToCourseBin).attr("value", "Add");
    $(addToCourseBin).text("Add");
  }
}

//Each row (which corresponds to a single lecture/lab/discussion time) needs to be parsed for times and spots available
function parseRegistrationNumbers(section) {
  //Find registration numbers for this row, formatted like "# of #". Hidden content also prepends it with Registered:
  // so that must be cut out
  const rows = $(section).find(".section_row");
  const regNumElem =
    rows.toArray().find((r) => r.innerText.includes("Registered:")) ||
    $(section).find(".RegSeatCol")[0];
  let regNum;
  addNotifyMe(section);
  //Cut out hidden text before it
  //If class has reg details
  if (regNumElem) {
    regNum = regNumElem.textContent.replace("Registered: ", "").trim();
    //create array using "of" as delimiter
    regNum = regNum.split("of");
    if (regNum.length !== 2) {
      currectSectionIsClosed = true;
      if (
        regNum[0] !== null &&
        regNum[0].trim() === "Closed" &&
        !classHasLectureSection
      ) {
        allLecturesClosed = true;
      }
      if (!$(section).hasClass("blank_rating")) {
        $(section).addClass("blank_rating");
        const rows = $(section).find(".section_row").toArray();
        const instructorRow = rows.find((r) =>
          r.innerText.includes("Instructor")
        );
        if (instructorRow) $(instructorRow).after(emptySpanCell);
      }
    } else {
      addRegistrationNumbers(section, regNum[0].trim(), regNum[1].trim());
    }
  }
}

//Any course that is full will get a Notify Me button, which allows users to type in their information and be notified
// if the class opens up again
function addNotifyMe(section) {
  let addToCourseBinButton = $(section).find(".addtomycb, .add-to-course-bin");
  // filter out any with the notify class
  addToCourseBinButton = addToCourseBinButton.filter(
    (i, el) => !$(el).hasClass("notify")
  );
  if (addToCourseBinButton.length !== 0) {
    $(addToCourseBinButton[0]).after(
      '<input name="submit" value="Notify Me" class="btn btn-default addtomycb col-xs-12 notify" type="button">'
    );
  }
  ///If the class is already in their coursebin (doesn't mean they've registered for it, though - this fixes the edge
  // case that a lot of people have, in which they have a course in their coursebin and are just waiting for a spot to
  // open up)
  const alreadyInCourseBin = $(section).find(".alrdyinmycb");
  if (alreadyInCourseBin.length !== 0) {
    $(alreadyInCourseBin).replaceWith(
      '<input name="submit" value="Notify Me" class="btn btn-default addtomycb col-xs-12" type="button">'
    );
    let addToCourseBinAlready = $(section).find(
      ".addtomycb, .add-to-course-bin"
    );
    addToCourseBinAlready = addToCourseBinAlready[0];
    $(addToCourseBinAlready).attr("value", "Notify Me");
    $(addToCourseBinAlready).removeAttr("type");
    $(addToCourseBinAlready).addClass("notify");
  }
}

// TODO: Fix this function, as it does too many things that are unrelated
function addRegistrationNumbers(section, enrolled, total) {
  //Gets each of ("# of #")
  //TODO: This utilizes global variables :( Sorry future person debugging this, I'll try to do a refactor before I
  // leave USC
  currentEnrolled = parseInt(enrolled);
  totalAvailable = parseInt(total);
  //Checks class type - we are only interested in Lecture and Lecture-Lab
  const rows = $(section).find(".section_row");
  if (!rows.length) {
    return;
  }
  const classTypeElem = rows
    .toArray()
    .find((r) => r.innerText.includes("Type:"));
  let classType;
  if (classTypeElem) {
    classType = classTypeElem.textContent
      .trim()
      .replace(/\s+/gi, "")
      .split("Type:")
      .filter((l) => l.trim())[0];
    parseClassType(section, classType);
  }
}

// Parses each row for what type of class it is, and whether there are still spots
function parseClassType(row, classType) {
  if (
    classType === "Lecture" ||
    classType === "Lecture-Lab" ||
    classType === "Lecture-Discussion"
  ) {
    //It's not a lab, so isOnlyLabSections is false
    isOnlyLabSections = false;
    classHasLectureSection = true;
    classTotalSpots += totalAvailable;
    classAvailableSpots += totalAvailable - currentEnrolled;
    allLecturesClosed = false;
  } else if (classType === "Lab") {
    classTotalSpotsLabOnly += totalAvailable;
    classAvailableSpotsLabOnly += totalAvailable - currentEnrolled;
  } else if (classType === "Discussion") {
    isOnlyLabSections = false;
    currentSectionHasDiscussion = true;
    classDiscussionTotalSpots += totalAvailable;
    classDiscussionAvailableSpots += totalAvailable - currentEnrolled;
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
    const rows = $(row).find(".section_row").toArray();
    const instructorRow = rows.find((r) => r.innerText.includes("Instructor"));
    if (instructorRow) $(instructorRow).after(emptySpanCell);
  }
}

function insertProfessorRating(row, professors) {
  for (const prof of professors) {
    const url = ratingURLTemplate + prof.legacyId;
    //To prevent reinserting, or if there are multiple professors, we insert an anchor with a rating class
    //if there already is one then we know it's another professor
    if ($(row).find(".rating").length !== 0) {
      $(row)
        .find(".rating")
        .after(`, <a href=${url}>${prof.avgRating || "Link"}</a>`);
    } else {
      $(row).addClass("blank_rating");
      //long string but needs to be exactly formatted
      const rows = $(row).find(".section_row").toArray();
      const instructorRow = rows.find((r) =>
        r.innerText.includes("Instructor")
      );
      //actual contents of rating
      let rating_anchor = `<a class="rating" href=${url} target="_blank">Link</a>`;
      // If you want the rating on the page, just delete the string above and rename the one below this comment to
      // rating_anchor
      const rating_anchor_with_score = `<a class="rating" href=${url} target="_blank">${
        prof.avgRating || "Link"
      }</a>`;
      if (options.showRatings) {
        rating_anchor = rating_anchor_with_score;
      }
      //long string just to include new
      $(instructorRow).after(
        `<span class="hours_alt1 text-md-center col-xs-12 col-sm-12 col-md-1 col-lg-1"><span class="hidden-lg hidden-md hidden-visible-xs-* visible-sm-* table-headers-xsmall">Prof. Rating: </span>${rating_anchor}</span>`
      );
      /* Very specific edge case - if you have two professors and you could not find the first, it'll insert an empty cell. However, if you can
               find the second you still want his score to be visible, so we need to remove the previously inserted blank one */
      if ($(row).find(".empty_rating").length !== 0) {
        $(row).find(".empty_rating")[0].remove();
      }
    }
  }
}

function parseSections(sections) {
  $(sections).each(function () {
    try {
      //rename Add to myCourseBin button so that it fits/looks nice
      changeAddToCourseBinButton(this);
      parseRegistrationNumbers(this);
      //Retrieve Instructor cell from row
      const rows = $(this).find(".section_row").toArray();
      const instructorRow = rows.find((r) =>
        r.innerText.includes("Instructor")
      );

      if (!instructorRow) {
        //I don't think this code actually ever runs, as USC creates blank cells with that class if it's empty, but
        // better safe than sorry here. If in the future they change it this'll prevent it from looking misaligned
        insertBlankRatingCell(this);
        //jQuery way of saying continue;
        return true;
      }
      //get all professor names in a hacky way
      const instructors = instructorRow.innerText
        .replace("Instructor:", "")
        .trim();
      //split on line breaks
      const names = instructors
        .trim()
        .split("<br>")
        .filter(Boolean)
        .flatMap((l) => l.split("\n"))
        .map((l) => l.trim())
        .filter(Boolean);

      if (!names.length) {
        //I don't think this code actually ever runs, as USC creates blank cells with that class if it's empty, but
        // better safe than sorry here. If in the future they change it this'll prevent it from looking misaligned
        insertBlankRatingCell(this);
        //jQuery way of saying continue;
        return true;
      }
      //if there are multiple instructors
      for (const name of names) {
        //single instructor name, comma delimited
        parseProfessor(name, this);
      }
    } catch (e) {
      console.error(e);
      console.error(`Failed to parse row ${this}!`);
    }
  });
}

function parseProfessor(instructor, row) {
  let nameParts = instructor.split(/[, ]/).filter(Boolean);
  //generate actual name
  const professors =
    professorRatings.get(getCleanName(`${nameParts[1]} ${nameParts[0]}`)) ||
    professorRatings.get(
      getCleanName([nameParts.pop(), ...nameParts].join(" "))
    ) ||
    professorRatings.get(getCleanName(nameParts.reverse().join(" ")));
  //If instructor name in json
  if (professors) {
    insertProfessorRating(row, professors);
  } else {
    insertBlankRatingCell(row);
  }
}

function insertProfRatingHeader(header) {
  if (!header) {
    return;
  }
  let rows = $(header).find(".section_row");
  const instructorRow =
    rows.toArray().find((r) => r.innerText.includes("Instructor")) || rows[7];
  if (instructorRow) {
    $(instructorRow).before(
      '<span class="section_row col-md-1 col-lg-1"><b>Prof. Rating</b></span>'
    );
  }
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
  const name = $(nameElem).find(".course-title-indent");
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
  const name = $(nameElem).find(".course-title-indent");
  if (currentSectionHasDiscussion) {
    name.append(
      `<span class="crsTitl spots_remaining"> - closed registration (${classDiscussionAvailableSpots} spots remaining)</span>`
    );
  } else {
    name.append(
      '<span class="crsTitl spots_remaining">' + " - closed registration</span>"
    );
  }
  //Let's make the background red if no spots remaining
  $(name).css("background-color", "rgba(240, 65, 36, 0.45)");
}

function insertOnlyLabNumbers(element) {
  const nameElem = $(element).prev();
  const name = $(nameElem).find(".course-title-indent");
  name.append(
    `<span class="crsTitl spots_remaining"> - ${classAvailableSpotsLabOnly} remaining lab spots</span>`
  );
  if (classAvailableSpotsLabOnly === 0) {
    $(name).css("background-color", "rgba(240, 65, 36, 0.45)");
  }
}

function insertAllOverlap(element) {
  const nameElem = $(element).prev();
  const name = $(nameElem).find(".course-title-indent");
  //Let's make the background orange if all lectures overlap
  let color = $(name).css("background-color");
  if (color == "rgba(240, 65, 36, 0.45)") {
    $(name).css(
      "background",
      "linear-gradient(to right, rgba(240, 65, 36, 0.45) , rgba(255, 134, 47, 0.37))"
    );
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
  if (
    isOnlyLabSections &&
    classTotalSpotsLabOnly !== 0 &&
    isNumber(classTotalSpotsLabOnly)
  ) {
    insertOnlyLabNumbers(element);
  }
}

function addUnitsToTitle(row) {
  if (options.showUnits) {
    // get units
    let sections = $(row).find(".section");
    if (sections.length === 0) {
      return;
    }
    for (const section of sections) {
      let rows = $(section).find(".section_row");

      // 3 is because the header has two elements that start with type_alt
      if (rows.length > 3) {
        let actualUnits = $(rows)[3].innerText;
        actualUnits = actualUnits.replace("Units: ", "").trim();
        if (actualUnits.trim() === "0.0") {
          continue;
        }
        const unitText = `<span class="crsTitl spots_remaining"> - ${actualUnits} units</span>`;
        let header = $(row).prev();
        let headerText = $(header).find(".course-title-indent");
        const title = $(headerText).find(".crsTitl")[0];
        if (title) {
          title.innerText = `${title.innerText} - ${actualUnits} units`;
        } else {
          $(headerText).append(unitText);
        }
        return;
      }
    }
  }
}

function parseClass(classes) {
  $(classes).each(function () {
    try {
      //set global variables to 0 (counts, class closed, class type, etc)
      reinitializeVariablesPerClass();
      addUnitsToTitle(this);
      //Insert Prof Rating column at top of each class view
      const header = $(this).find(".section_head");
      insertProfRatingHeader(header);
      //Iterate over every section in row. To get alternating colors, USC uses alt0 and alt1, so we must search for both
      const sections = $(this).find(".section_crsbin");
      parseSections(sections);
      //If total spots is a number and it's not 0, insert
      insertClassNumbers(this);
    } catch (e) {
      console.error(e);
      console.error("Failed to parse a class!");
    }
  });
}

function changeCSSColumnWidth() {
  //Sets CSS of page to display everything correctly
  $(".rm_").css({
    width: "4%",
  });
  $(".btnAddToMyCourseBin").css({
    width: "12%",
    float: "right",
  });

  $(".session").css({
    width: "4%",
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
  const classes = $(".accordion-content-area");
  //Parses each class found previously
  parseClass(classes);
  addPostRequests();
}

//Credit to http://stackoverflow.com/questions/8525899/how-to-check-if-a-javascript-number-is-a-real-valid-number
//Checks if a number is valid
function isNumber(n) {
  return typeof n === "number" && !isNaN(n) && isFinite(n);
}

function parseCoursePage() {
  //Get all courses
  const courses = $(".course-info");
  let totalSpots = 0;
  let availSpots = 0;
  //Iterate over courses on page
  for (let i = 0; i < courses.length; i++) {
    totalSpots = 0;
    availSpots = 0;
    //Get table with jQuery selector
    const table = $(courses[i]).find("> .course-details > table.sections");
    //Get rows, iterate over each one
    $(table[0])
      .find("> tbody > tr")
      .each(function () {
        if ($(this).hasClass("headers")) {
          //create new column
          $(this).find(".instructor").after("<th>Prof. Rating</th>");
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
        const registratioNumbers = $(this)
          .find("td.registered")[0]
          .textContent.split(" of ");
        const currentlyEnrolled = parseInt(registratioNumbers[0]);
        const totalAvailable = parseInt(registratioNumbers[1]);
        //If it's not a lab or quiz
        if (type === "Lecture" || type === "Lecture-Lab") {
          totalSpots += totalAvailable;
          availSpots += totalAvailable - currentlyEnrolled;
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
          name = getCleanName(`${name[0]} ${name[name.length - 1]}`);
          //If its in JSON
          const professors = professorRatings.get(name);
          if (professors) {
            //generate RMP URL
            for (const prof of professors) {
              const url = ratingURLTemplate + prof.legacyId;
              //If we've never inserted before, insert. Otherwise insert with a comma before it for good formatting
              if ($(this).find(".rating").length === 0) {
                if (options.showRatings) {
                  $(this)
                    .find("td.instructor")
                    .after(
                      `<td class="rating"><a href=${url} target="_blank">${
                        prof.avgRating || "Link"
                      }</a></td>`
                    );
                } else {
                  $(this)
                    .find("td.instructor")
                    .after(
                      `<td class="rating"><a href=${url} target="_blank">Link</a></td>`
                    );
                }
              } else {
                $(this)
                  .find(".rating")
                  .append(
                    `, <a href=${url} target="_blank">${
                      prof.avgRating || "Link"
                    }</a>`
                  );
              }
            }
          } else {
            //If not in JSON, we need an empty space to make table format correctly
            if ($(this).find(".rating").length === 0) {
              $(this).find("td.instructor").after('<td class="rating"> </td>');
            } else {
              $(this).find(".rating").append(" ");
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
  let pos1 = 0;
  let pos2 = 0;
  let pos3 = 0;
  let pos4 = 0;
  if (document.getElementById(`${elmnt.id}Header`)) {
    /* if present, the header is where you move the DIV from:*/
    document.getElementById(`${elmnt.id}Header`).onmousedown = dragMouseDown;
  } else {
    /* otherwise, move the DIV from anywhere inside the DIV:*/
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e = window.event) {
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e = window.event) {
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    elmnt.style.top = `${elmnt.offsetTop - pos2}px`;
    elmnt.style.left = `${elmnt.offsetLeft - pos1}px`;
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
  if (prevent.includes(scheduled)) {
    setTimeout(() => {}, 0);
    e.preventDefault();
  }

  if (e.event.Scheduled == "Block") {
    setTimeout(() => {}, 0);
    $(".k-window-title").text("Block Time");
  }

  if (e.event.Scheduled == "") {
    setTimeout(() => {}, 0);
    $(".k-window-title").text("Block Time");
  }
}
