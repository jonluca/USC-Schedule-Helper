let options;
let count = 3;
$(() => {
  $("body").on("click", "a", function () {
    chrome.tabs.create({
      url: $(this).attr("href"),
    });
    return false;
  });
  loadOptions((recOptions) => {
    options = recOptions;
    $("#chkExtensionDisabled").prop("checked", options.extensionEnabled);
    $("#chkConflicts").prop("checked", options.showConflicts);
    $("#chkCalendar").prop("checked", options.showCalendar);
    $("#chkUnits").prop("checked", options.showUnits);
    $("input:checked").trigger("gumby.check");

    $("input")
      .parent()
      .on("gumby.onChange", function () {
        changeOption(this);
      });
    // ===================================================================================================================================================================================
    // =    ===========    ========================================================================  ===================  =====  =======  ===================    =========================
    // ==  ===========  ==  =======================================================================  ===================  =====  =======  ==================  ==  ========================
    // ==  ===========  ========================================  =================================  ===================  =====  =======  ==================  ============================
    // ==  ===  = ===    ======   ===  =   ===  =  = ====   ===    ==  ===   ===  = =========   ===  ======   ===  =  ==  =====  =======  ======   ========    =====  =   ====   ====   ==
    // ==  ===     ===  ======     ==    =  ==        ==  =  ===  =======     ==     =======  =  ==    ===     ==  =  ==  ===    =======    ===  =  ========  ======    =  ==  =  ==  =  =
    // ==  ===  =  ===  ======  =  ==  =======  =  =  =====  ===  ===  ==  =  ==  =  ========  ====  =  ==  =  ==  =  ==  ==  =  =======  =  ==     ========  ======  =======     ==     =
    // ==  ===  =  ===  ======  =  ==  =======  =  =  ===    ===  ===  ==  =  ==  =  =========  ===  =  ==  =  ==  =  ==  ==  =  =======  =  ==  ===========  ======  =======  =====  ====
    // ==  ===  =  ===  ======  =  ==  =======  =  =  ==  =  ===  ===  ==  =  ==  =  =======  =  ==  =  ==  =  ==  =  ==  ==  =  =======  =  ==  =  ========  ======  =======  =  ==  =  =
    // =    ==  =  ===  =======   ===  =======  =  =  ===    ===   ==  ===   ===  =  ========   ===  =  ===   ====    ==  ===    =======    ====   =========  ======  ========   ====   ==
    // ===================================================================================================================================================================================
    // Update August 2019 - I graduated so I'm reenabling this :)
    $(".secret").click(() => {
      --count;
      if (count == 0) {
        options.showRatings = true;
        saveOptions();
      }
    });
  });
});

function changeOption({ htmlFor }) {
  switch (htmlFor) {
    case "chkExtensionDisabled":
      options.extensionEnabled = $("#chkExtensionDisabled")[0].checked;
      break;
    case "chkCalendar":
      options.showCalendar = $("#chkCalendar")[0].checked;
      break;
    case "chkConflicts":
      options.showConflicts = $("#chkConflicts")[0].checked;
      break;
    case "chkUnits":
      options.showUnits = $("#chkUnits")[0].checked;
      break;
  }
  saveOptions();
}

function saveOptions() {
  chrome.storage.sync.set(
    {
      options: options,
    },
    () => {
      sendOptions(options);
    }
  );
}
