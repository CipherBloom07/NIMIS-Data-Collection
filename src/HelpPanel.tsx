import { BookOpen, Camera, CheckCircle2, ClipboardList, CloudOff, FilePlus2, MapPin, Save, ShieldAlert } from 'lucide-react';

export default function HelpPanel() {
  return <section className="help-page" aria-labelledby="help-title">
    <div className="heading-row">
      <div><div className="overline">NIMIS / FIELD SUPPORT</div>
        <h1 id="help-title">How to use NIMIS Collect</h1>
        <p>Simple instructions for officers collecting irrigation scheme information.</p>
      </div>
    </div>
    <div className="panel">
      <div className="panel-title"><div><h2>Getting started</h2><p>Follow these steps in order. The instructions are available even when your internet is off, after the app has loaded.</p></div><BookOpen size={24}/></div>
      <div className="help-steps">
        <article><span>1</span><div><h3><ClipboardList size={18}/> Find the scheme</h3>
          <p>Choose <strong>Assigned schemes</strong> to check which scheme you are supposed to work on. For now, this screen only shows fictional reference data. Official assignments are not yet connected.</p></div></article>
        <article><span>2</span><div><h3><FilePlus2 size={18}/> Start a survey</h3>
          <p>Choose <strong>New survey</strong>. Enter the site name, scheme name, and province. Answer the questions in the current section before going to the next.</p></div></article>
        <article><span>3</span><div><h3><Camera size={18}/> Add evidence</h3>
          <p>Where requested, tap <strong>Take / select photo</strong>. Allow access to your camera if prompted. Photographs are stored on your current device, not uploaded.</p></div></article>
        <article><span>4</span><div><h3><MapPin size={18}/> Record location</h3>
          <p>Tap <strong>Capture GPS</strong> while standing near the relevant point. Allow location permission, wait for the reading, and check the accuracy. GPS needs a device with location capabilities.</p></div></article>
        <article><span>5</span><div><h3><Save size={18}/> Save and return later</h3>
          <p>Choose <strong>Save & dashboard</strong> whenever you need to stop. Your survey is also autosaved while you enter information. From the dashboard, open a saved draft to continue.</p></div></article>
        <article><span>6</span><div><h3><CheckCircle2 size={18}/> Review your answers</h3>
          <p>Use the section counts and <strong>Review validation details</strong> to find missing or inconsistent answers. Saving a draft is not the same as submitting an official report.</p></div></article>
      </div>
    </div>
    <div className="help-safety">
      <div><CloudOff size={22}/><strong>Working without internet</strong>
        <p>Existing drafts and the questionnaire can be used locally after loading the app. Test offline recovery on the actual device before relying on it in the field. Do not clear browser data or uninstall the app while work is unsynced.</p></div>
      <div><ShieldAlert size={22}/><strong>Important limitation</strong>
        <p>This is a development version. Official sign-in, encryption, server uploads, district verification and national publication are not operational. Do not enter confidential farmer or Ministry records until these controls are approved.</p></div>
    </div>
  </section>;
}
