(function () {
  var late = ["18:00 до 18:30", "18:00 до 18:30", "18:00 до 18:30", "18:00 до 18:30", "18:00 до 18:30", "18:00 до 18:30", "15:30 до 20:00"];
  var names = ["неделя", "понеделник", "вторник", "сряда", "четвъртък", "петък", "събота"];
  var d = new Date().getDay();
  var t = document.getElementById("today");
  if (t) { t.textContent = "Днес, " + names[d] + ", храмът е отворен от 7:30 до 9:00 и от " + late[d] + "."; }
  var r = document.querySelector('[data-day="' + d + '"]');
  if (r) { r.className = "today"; }
})();
