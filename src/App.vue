<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  addKey,
  checkout,
  csv,
  emptyWorkspace,
  localDate,
  returnKey,
  validate,
} from "./model";
import { change, download, read, replace } from "./repository";
const state = ref(structuredClone(emptyWorkspace));
const ready = ref(false);
const busy = ref(false);
const message = ref("");
const query = ref("");
const tab = ref("register");
const selected = ref("");
const restoreInput = ref(null);
const restoreConsent = ref(false);
const previous = ref(null);
let channel;
const openLoans = computed(() =>
  state.value.loans.filter((loan) => loan.returnedAt === null),
);
const overdue = computed(() =>
  openLoans.value.filter((loan) => loan.due < localDate()),
);
const visible = computed(() =>
  state.value.keys.filter((key) =>
    `${key.tag} ${key.property} ${openLoans.value.find((loan) => loan.keyId === key.id)?.borrower || ""}`
      .toLowerCase()
      .includes(query.value.toLowerCase()),
  ),
);
onMounted(async () => {
  try {
    state.value = await read();
    ready.value = true;
    channel = new BroadcastChannel("keynest-updates");
    channel.onmessage = async () => {
      try {
        state.value = await read();
      } catch (error) {
        message.value = error.message;
      }
    };
  } catch {
    message.value =
      "Browser storage could not be opened. Try a browser with IndexedDB enabled.";
  }
});
onUnmounted(() => channel?.close());
async function mutate(action, success) {
  busy.value = true;
  try {
    state.value = await change(action);
    channel?.postMessage("updated");
    message.value = success;
    return true;
  } catch (error) {
    message.value = error.message;
    return false;
  } finally {
    busy.value = false;
  }
}
async function submit(event, type) {
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  if (
    await mutate(
      (current) =>
        type === "key" ? addKey(current, values) : checkout(current, values),
      type === "key" ? "Key added to the register." : "Handover recorded.",
    )
  ) {
    form.reset();
    tab.value = "register";
  }
}
async function restore(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  busy.value = true;
  try {
    if (!restoreConsent.value)
      throw new Error(
        "Tick the replacement checkbox before restoring a backup.",
      );
    if (file.size > 10000000)
      throw new Error("Use a backup smaller than 10 MB.");
    const next = validate(JSON.parse(await file.text()));
    previous.value = JSON.parse(JSON.stringify(state.value));
    state.value = await replace(next);
    channel?.postMessage("updated");
    restoreConsent.value = false;
    message.value =
      "Backup restored. You can undo this replacement until the page is closed.";
  } catch (error) {
    message.value = error.message;
  } finally {
    busy.value = false;
    event.target.value = "";
  }
}
function printView() {
  window.print();
}
function keyName(id) {
  return state.value.keys.find((key) => key.id === id);
}
</script>
<template>
  <header>
    <a class="brand" href="#main"><span>⚿</span>keynest.</a
    ><span class="header-caption">A SMALL REGISTER. A BIG WEIGHT OFF.</span
    ><a href="https://github.com/goshkaaaa/keynest">Source ↗</a>
  </header>
  <main id="main">
    <section class="hero">
      <div>
        <p class="eyebrow">FOR THE KEYS THAT KEEP MOVING</p>
        <h1>Who has<br />the <span>keys?</span></h1>
        <p>
          For apartments, shared spaces, and small teams.<br />Keep the
          handover. Lose the guesswork.
        </p>
      </div>
      <div class="key-tag">
        <span>PROPERTY KEY REGISTER</span
        ><strong>{{ String(state.keys.length).padStart(2, "0") }}</strong>
        <div><span>registered keys</span><i>⚿</i></div>
        <small>EVERY KEY. ACCOUNTED FOR.</small>
      </div>
    </section>
    <section class="numbers" aria-label="Register summary">
      <div>
        <strong>{{ state.keys.length - openLoans.length }}</strong
        ><span>in the cabinet</span>
      </div>
      <div>
        <strong>{{ openLoans.length }}</strong
        ><span>currently out</span>
      </div>
      <div :class="{ alert: overdue.length }">
        <strong>{{ overdue.length }}</strong
        ><span>past the return date</span>
      </div>
      <button
        class="primary"
        :disabled="!ready || busy"
        @click="tab = 'handover'"
      >
        Record a handover ↗
      </button>
    </section>
    <div class="section-toolbar">
      <nav aria-label="Workspace">
        <button :aria-pressed="tab === 'register'" @click="tab = 'register'">
          The register</button
        ><button :aria-pressed="tab === 'new'" @click="tab = 'new'">
          Add a key +</button
        ><button :aria-pressed="tab === 'history'" @click="tab = 'history'">
          Handover history</button
        ><button :aria-pressed="tab === 'backups'" @click="tab = 'backups'">
          Backups
        </button>
      </nav>
      <label v-if="tab === 'register'" class="search"
        ><span class="sr-only">Search keys</span
        ><input v-model="query" placeholder="Find a tag, address, or person…"
      /></label>
    </div>
    <p role="status" class="notice">{{ message }}</p>
    <section v-if="tab === 'register'" class="register">
      <div v-if="!state.keys.length" class="empty">
        <span>⚿</span>
        <h2>Start with the first set.</h2>
        <p>
          Add a key tag and its property. No records are created until you add
          them.
        </p>
        <button class="primary" :disabled="!ready" @click="tab = 'new'">
          Add your first key +
        </button>
      </div>
      <div v-else-if="!visible.length" class="empty">
        <h2>No keys match that search.</h2>
      </div>
      <div class="key-grid">
        <article v-for="key in visible" :key="key.id" class="key-card">
          <div class="card-top">
            <span class="tag-label">{{ key.tag }}</span
            ><span
              class="badge"
              :class="{ out: openLoans.some((loan) => loan.keyId === key.id) }"
              >{{
                openLoans.some((loan) => loan.keyId === key.id)
                  ? "CHECKED OUT"
                  : "IN CABINET"
              }}</span
            >
          </div>
          <h2>{{ key.property }}</h2>
          <p>{{ key.notes || "No storage notes added." }}</p>
          <template v-if="openLoans.find((loan) => loan.keyId === key.id)"
            ><div class="holder">
              <span>WITH</span
              ><strong>{{
                openLoans.find((loan) => loan.keyId === key.id).borrower
              }}</strong
              ><small
                >Due
                {{ openLoans.find((loan) => loan.keyId === key.id).due }}</small
              >
            </div>
            <button
              class="return-button"
              :disabled="busy"
              @click="
                mutate(
                  (current) =>
                    returnKey(
                      current,
                      openLoans.find((loan) => loan.keyId === key.id).id,
                    ),
                  'Key returned to the cabinet.',
                )
              "
            >
              Mark returned ✓
            </button></template
          ><template v-else
            ><div class="holder">
              <span>READY FOR</span><strong>The next handover.</strong
              ><small
                >{{
                  state.loans.filter((loan) => loan.keyId === key.id).length
                }}
                past handovers</small
              >
            </div>
            <button
              :disabled="busy"
              @click="
                selected = key.id;
                tab = 'handover';
              "
            >
              Hand over this key ↗
            </button></template
          >
        </article>
      </div>
    </section>
    <section v-if="tab === 'new'" class="form-layout">
      <div>
        <p class="eyebrow">A PLACE IN THE REGISTER</p>
        <h2>Give every set<br />a proper home.</h2>
        <p>Use the physical tag on the keyring as its unique reference.</p>
      </div>
      <form @submit.prevent="submit($event, 'key')">
        <label
          >Key tag<input
            name="tag"
            maxlength="40"
            placeholder="A-014"
            required /></label
        ><label
          >Property / address<input
            name="property"
            maxlength="200"
            required
            placeholder="Apartment, office, or shared space" /></label
        ><label
          >Storage / access notes<textarea
            name="notes"
            maxlength="1000"
            placeholder="Cabinet position or what this set opens"
          ></textarea></label
        ><button class="primary" :disabled="busy || !ready">
          Add to register +
        </button>
      </form>
    </section>
    <section v-if="tab === 'handover'" class="form-layout">
      <div>
        <p class="eyebrow">THE MOMENT THAT MATTERS</p>
        <h2>A handover<br />you can trace.</h2>
        <p>
          Record who takes the keys and when they should come back. This is an
          operational log, not a digital signature.
        </p>
      </div>
      <form
        v-if="state.keys.length > openLoans.length"
        @submit.prevent="submit($event, 'loan')"
      >
        <label
          >Key<select name="keyId" v-model="selected" required>
            <option value="" disabled>Choose an available key</option>
            <option
              v-for="key in state.keys.filter(
                (key) => !openLoans.some((loan) => loan.keyId === key.id),
              )"
              :key="key.id"
              :value="key.id"
            >
              {{ key.tag }} · {{ key.property }}
            </option>
          </select></label
        ><label
          >Handed to<input
            name="borrower"
            maxlength="100"
            required
            placeholder="Person taking the keys" /></label
        ><label
          >Return by<input
            name="due"
            type="date"
            :min="localDate()"
            required /></label
        ><label
          >Handover note<textarea
            name="note"
            maxlength="1000"
            placeholder="Number of keys, condition, or reason"
          ></textarea></label
        ><button class="primary" :disabled="busy || !ready">
          Record handover ↗
        </button>
      </form>
      <div v-else class="empty">
        <h3>No keys are available.</h3>
        <p>Add a key or record the return of an existing set.</p>
      </div>
    </section>
    <section v-if="tab === 'history'" class="history">
      <div class="history-heading">
        <h2>The paper trail.</h2>
        <button
          class="outline"
          @click="download('keynest-handovers.csv', csv(state), 'text/csv')"
        >
          Export CSV ↓
        </button>
      </div>
      <p v-if="!state.loans.length" class="empty">
        Your first handover will appear here.
      </p>
      <article v-for="loan in [...state.loans].reverse()" :key="loan.id">
        <span class="tag-label">{{ keyName(loan.keyId)?.tag }}</span>
        <div>
          <h3>{{ keyName(loan.keyId)?.property }}</h3>
          <p>
            {{ loan.borrower }} · issued
            {{ new Date(loan.outAt).toLocaleString() }}
          </p>
          <small>{{ loan.note }}</small>
        </div>
        <span class="badge" :class="{ out: loan.returnedAt === null }">{{
          loan.returnedAt ? "RETURNED" : "OUT · DUE " + loan.due
        }}</span
        ><button
          v-if="loan.returnedAt === null"
          :disabled="busy"
          @click="
            mutate((current) => returnKey(current, loan.id), 'Return recorded.')
          "
        >
          Return ✓
        </button>
      </article>
    </section>
    <section v-if="tab === 'backups'" class="backup-panel">
      <h2>Keep a copy. Keep control.</h2>
      <p>
        Records live in this browser. A backup moves them to another device or
        keeps a separate copy.
      </p>
      <button
        class="primary"
        :disabled="!ready"
        @click="
          download(
            'keynest-backup.json',
            JSON.stringify(state, null, 2),
            'application/json',
          )
        "
      >
        Export backup ↓
      </button>
      <div>
        <label class="consent"
          ><input type="checkbox" v-model="restoreConsent" />I want to replace
          the current register with a backup.</label
        ><input
          ref="restoreInput"
          type="file"
          accept=".json,application/json"
          aria-label="Restore Keynest backup"
          :disabled="!restoreConsent || busy"
          @change="restore"
        /><button
          v-if="previous"
          class="outline"
          @click="
            mutate(
              () => JSON.parse(JSON.stringify(previous)),
              'Previous register restored.',
            );
            previous = null;
          "
        >
          Undo replacement ↶
        </button>
      </div>
    </section>
  </main>
  <footer>
    <span>keynest.</span>
    <p>Stored on this device. Export a backup to keep it.</p>
    <button @click="printView">Print this view ↗</button>
  </footer>
</template>
