
    $('.loader').hide();
    $('.main').show();

    function formatDate(unixtime) {

      // not unixtime? return as may be human-readable date
      if (unixtime.toString().length < 13) {
        return unixtime;
      }

      x = new Date(unixtime);
      nowx = new Date();

      y = "";

      if (x.getMonth() + 1 == 1) {
        y += "Jan ";
      }
      if (x.getMonth() + 1 == 2) {
        y += "Feb ";
      }
      if (x.getMonth() + 1 == 3) {
        y += "Mar ";
      }
      if (x.getMonth() + 1 == 4) {
        y += "Apr ";
      }
      if (x.getMonth() + 1 == 5) {
        y += "May ";
      }
      if (x.getMonth() + 1 == 6) {
        y += "Jun ";
      }
      if (x.getMonth() + 1 == 7) {
        y += "Jul ";
      }
      if (x.getMonth() + 1 == 8) {
        y += "Aug ";
      }
      if (x.getMonth() + 1 == 9) {
        y += "Sep ";
      }
      if (x.getMonth() + 1 == 10) {
        y += "Oct ";
      }
      if (x.getMonth() + 1 == 11) {
        y += "Nov ";
      }
      if (x.getMonth() + 1 == 12) {
        y += "Dec ";
      }

      y += x.getDate();

      if (x.getFullYear() != nowx.getFullYear()) {
        y += " ";
        y += x.getFullYear();
      } else {
        if (x.getMonth() == nowx.getMonth() && x.getDate() == nowx.getDate()) {

          am_or_pm = "am";

          tmphour = x.getHours();
          tmpmins = x.getMinutes();

          if (tmphour >= 12) {
            if (tmphour > 12) {
              tmphour -= 12;
            };
            am_or_pm = "pm";
          }
          if (tmphour == 0) {
            tmphour = 12;
          };
          if (tmpmins < 10) {
            y = tmphour + ":0" + tmpmins + " " + am_or_pm;
          } else {
            y = tmphour + ":" + tmpmins + " " + am_or_pm;
          }
        }
      }
      return y;
    }

    var new_time = new Date().getTime();
    $('#tmp_current_time').html(formatDate(new_time));

