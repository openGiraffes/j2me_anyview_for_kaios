/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

var fakeContacts = [
{
  id: 0,
  name: ["Test Contact 0"],
  familyName: ["Contact 0"],
  tel: null,
},
{
  id: 1,
  name: ["Test Contact 1"],
  familyName: ["Contact 1"],
  tel: [{
    type: ["home"],
    pref: true,
    value: "+16505550100",
    carrier: "C1",
  },
  {
    type: ["work"],
    pref: false,
    value: "+16505550101",
    carrier: "C2",
  },],
},
{
  id: 2,
  name: ["Test Contact 2"],
  familyName: ["Contact 2"],
  tel: [{
    type: ["home"],
    pref: true,
    value: "+16505550102",
    carrier: "C3",
  },
  {
    type: ["work"],
    pref: false,
    value: "+16505550103",
    carrier: "C4",
  },],
},
{
  id: 3,
  name: ["Test Contact 3"],
  familyName: ["Contact 3"],
  tel: null,
},
{
  id: 4,
  name: ["Test Contact 4"],
  familyName: ["Contact 4"],
  tel: null,
},
{
  id: 5,
  name: ["Test Contact 5"],
  familyName: ["Contact 5"],
  tel: [{
    type: ["home"],
    pref: true,
    value: "+16505550104",
    carrier: "C5",
  },
  {
    type: ["work"],
    pref: false,
    value: "+16505550105",
    carrier: "C6",
  },],
},];

// Polyfill to enable testing in chrome.
if (typeof mozContact === "undefined") {
  function mozContact() {}
}

// Turn the contact object into a mozContact to make the testing
// environment more similar to reality.
function toMozContact(fakeContact) {
  var contact = new mozContact();

  for (var attr in fakeContact) {
    if (fakeContact.hasOwnProperty(attr)) {
      contact[attr] = fakeContact[attr];
    }
  }

  return contact;
}

navigator.mozContacts = {
  getAll: function() {
    var req = {};

    var contacts = fakeContacts.slice(0);

    req.continue = function() {
      nextTickBeforeEvents(function() {
        req.result = (contacts.length > 0) ? toMozContact(contacts.shift()) : null;
        req.onsuccess();
      });
    };

    req.continue();

    return req;
  }
};
