/* =============================================================================
   view-login.js

   The sign-in screen. The account list is not hard-coded in the page: it is a
   SPARQL query over med:Account, so adding an account to the Turtle adds it
   here with no other change.
   ========================================================================== */
var Login = (function () {
  'use strict';
  var el = App.el;

  var ROLE_ORDER = ['PatientRole', 'DoctorRole', 'AdminRole', 'LabRole', 'PharmacyRole'];
  var ROLE_COPY = {
    PatientRole:  'See your own record: visits, conditions, medicines, results and bills.',
    DoctorRole:   'Your caseload, safety alerts and the population view.',
    AdminRole:    'Whole-hospital records, staff, wards and the knowledge graph tools.',
    LabRole:      'The pending worklist and abnormal result review.',
    PharmacyRole: 'Prescriptions waiting to be dispensed, with interaction checking.'
  };

  function render() {
    var error = el('p', { class: 'login-error', text: '' });
    var loginInput = el('input', {
      type: 'email', id: 'login-email', class: 'field', autocomplete: 'username',
      placeholder: 'you@medisem.health', spellcheck: 'false'
    });
    var passInput = el('input', {
      type: 'password', id: 'login-pass', class: 'field', autocomplete: 'current-password',
      placeholder: 'Passcode'
    });

    function attempt() {
      error.textContent = '';
      var session = App.authenticate(loginInput.value, passInput.value);
      if (!session) {
        error.textContent = 'That email and passcode do not match an account.';
        passInput.focus();
        return;
      }
      window.location.hash = '#/home';
      App.route();
    }

    [loginInput, passInput].forEach(function (input) {
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') attempt(); });
    });

    var rows = App.accounts();
    var byRole = {};
    rows.forEach(function (a) {
      var role = RDF.local(RDF.I(a.role));
      (byRole[role] = byRole[role] || []).push(a);
    });

    var accountGroups = ROLE_ORDER.filter(function (r) { return byRole[r]; }).map(function (role) {
      var list = byRole[role];
      return el('div', { class: 'acct-group' }, [
        el('div', { class: 'acct-group-head' }, [
          el('h3', { text: list[0].roleName }),
          el('p', { text: ROLE_COPY[role] || '' })
        ]),
        el('div', { class: 'acct-list' }, list.map(function (a) {
          return el('button', {
            class: 'acct',
            onclick: function () {
              loginInput.value = a.login;
              passInput.value = 'demo1234';
              attempt();
            }
          }, [
            App.avatar(a.initials || a.subjectName, { tone: 'light' }),
            el('span', { class: 'acct-meta' }, [
              el('span', { class: 'acct-name', text: a.subjectName }),
              el('span', { class: 'acct-login mono', text: a.login })
            ])
          ]);
        }))
      ]);
    });

    var left = el('div', { class: 'login-aside' }, [
      el('div', { class: 'login-brand' }, [
        el('span', { class: 'brand-mark', html:
          '<svg viewBox="0 0 26 26" aria-hidden="true">' +
          '<line x1="5" y1="19" x2="13" y2="6" stroke="#4FBF95" stroke-width="1.4"/>' +
          '<line x1="13" y1="6" x2="21" y2="19" stroke="#7FA9D0" stroke-width="1.4"/>' +
          '<circle cx="5" cy="19" r="3" fill="#4FBF95"/>' +
          '<circle cx="13" cy="6" r="3" fill="#EAF0EE"/>' +
          '<circle cx="21" cy="19" r="3" fill="none" stroke="#7FA9D0" stroke-width="1.7"/></svg>' }),
        el('div', {}, [
          el('strong', { text: 'MediSem' }),
          el('span', { text: 'Multispecialty Hospital' })
        ])
      ]),

      el('h1', { class: 'login-headline', text: 'A hospital record that understands itself.' }),
      el('p', { class: 'login-blurb', text:
        'Every patient, visit, diagnosis, prescription and result in this system is stored as RDF ' +
        'and described by an OWL ontology. Care teams see an ordinary clinical interface. ' +
        'Underneath, safety alerts, disease categories and the comorbidity network are all worked ' +
        'out by a reasoner rather than written into the data.' }),

      el('div', { class: 'login-stats' }, [
        el('div', {}, [
          el('span', { class: 'ls-num', text: App.num(App.KG.stats.stated) }),
          el('span', { class: 'ls-label', text: 'triples stated' })
        ]),
        el('div', {}, [
          el('span', { class: 'ls-num ls-derived', text: App.num(App.KG.stats.derived) }),
          el('span', { class: 'ls-label', text: 'facts derived' })
        ]),
        el('div', {}, [
          el('span', { class: 'ls-num', text: App.num(Comorbidity.get().edges.length) }),
          el('span', { class: 'ls-label', text: 'comorbidity links found' })
        ])
      ]),

      el('p', { class: 'login-foot', text:
        'Demonstration system built for a Semantic Web project. All patients, staff and clinical ' +
        'records are fictional. Nothing here is medical advice.' })
    ]);

    var right = el('div', { class: 'login-main' }, [
      el('div', { class: 'login-card' }, [
        el('h2', { text: 'Sign in' }),
        el('p', { class: 'muted', text: 'Use a demo account below, or type the credentials yourself.' }),

        el('label', { class: 'field-label', for: 'login-email', text: 'Email' }),
        loginInput,
        el('label', { class: 'field-label', for: 'login-pass', text: 'Passcode' }),
        passInput,
        error,
        el('button', { class: 'btn btn-primary btn-block', text: 'Sign in', onclick: attempt }),

        el('div', { class: 'login-hint mono', text: 'Every demo passcode is  demo1234' })
      ]),

      el('div', { class: 'acct-panel' }, [
        el('h2', { class: 'acct-panel-title', text: 'Demo accounts' }),
        el('p', { class: 'muted', text: 'Pick one to sign straight in. Each role sees a different interface.' }),
        el('div', { class: 'acct-groups' }, accountGroups)
      ])
    ]);

    return el('div', { class: 'login' }, [left, right]);
  }

  return { render: render };
})();
