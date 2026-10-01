/**
 * Service definitions.
 *
 * Two kinds of page live here:
 *
 *  - `families` - the four services that the legacy site crossed with every
 *    suburb (computer repairs, PC repairs, Mac repairs, laptop repairs). Each
 *    one gets a hub page *and* a page per suburb, both rendered by the same
 *    component.
 *  - `services` - standalone pages for a specific job. These are hand-written
 *    because each one answers a distinct question with a distinct search.
 *
 * Content is deliberately specific per service. The legacy site reused one
 * block of copy across all ~1,650 suburb pages with the suburb name swapped in,
 * which reads as thin to a human and as doorway pages to a crawler. The suburb
 * pages here vary by service, by region and by suburb data, and lead with the
 * things a local customer actually asks about: price, turnaround, what gets
 * fixed on the first visit.
 */

export interface Faq {
  q: string;
  a: string;
}

export interface ServiceSection {
  h: string;
  /** Paragraphs. `{suburb}`, `{region}`, `{postcode}` are substituted at render. */
  p?: string[];
  list?: string[];
}

export interface Service {
  slug: string;
  /** The h1. Also used in <title> and og:title. */
  title: string;
  /** Short label for cards and nav. */
  shortTitle: string;
  /** <title> tag. Must be <= 60 chars to avoid truncation. */
  metaTitle: string;
  /** meta description. Aim 120-158 chars. */
  metaDescription: string;
  /** One-line summary used on cards and as the schema service description. */
  summary: string;
  icon: IconName;
  /** Icon set in body copy. Supports **bold** and `code`. */
  intro: string[];
  sections: ServiceSection[];
  faqs: Faq[];
  /** Slugs of related service pages, for the internal-link block. */
  related: string[];
  /** Rough job duration, shown as a "what to expect" fact. */
  turnaround: string;
  /** Starting/flat price where the legacy site published one. */
  price?: number;
}

export type IconName =
  | 'wrench'
  | 'desktop'
  | 'laptop'
  | 'apple'
  | 'shield'
  | 'database'
  | 'rocket'
  | 'network'
  | 'refresh'
  | 'gauge'
  | 'sparkle'
  | 'windows'
  | 'support'
  | 'star'
  | 'check';

/**
 * The four services that get a page in every suburb.
 *
 * `slug` is the hub page path. `suburbPrefix` is how the legacy URLs were
 * built, e.g. `pc-repairs` + `aspley` + `4066` -> `/pc-repairs-aspley-qld-4066/`.
 */
export interface ServiceFamily {
  slug: string;
  title: string;
  shortTitle: string;
  metaTitle: string;
  metaDescription: string;
  summary: string;
  icon: IconName;
  /** Legacy slug prefix. Used to match suburb records and build redirects. */
  suburbPrefix: string;
  /** Whether the legacy suburb URLs carried a postcode suffix. */
  suburbHasPostcode: boolean;
  /** Noun used in body copy, e.g. "desktop computer repairs". */
  noun: string;
  intro: string[];
  sections: ServiceSection[];
  faqs: Faq[];
  turnaround: string;
  /**
   * Service slugs linked from the family hub. Drives the internal-link block at
   * the bottom of every family page and is how a visitor arriving on
   * /computer-repairs/ gets a route to the specific job they need.
   */
  related: string[];
  /** Extra suburb-page sections shown only on the per-suburb pages. */
  suburbSections?: ServiceSection[];
}

export const families: ServiceFamily[] = [
  {
    slug: 'computer-repairs',
    title: 'Computer Repairs',
    shortTitle: 'Computer Repairs',
    metaTitle: 'Computer Repairs Brisbane | $150 Flat Rate | 7 Days',
    metaDescription:
      'Computer repairs in {suburb} and across Brisbane. Flat $150, no call-out fee, no weekend surcharge. Ex-IBM help desk technician. Call (07) 3155 2051.',
    summary:
      'Home and office computer repairs - hardware, software, viruses, slow performance and everything in between. One flat rate, no call-out fee.',
    icon: 'wrench',
    suburbPrefix: 'computer-repairs',
    suburbHasPostcode: false,
    noun: 'computer repairs',
    turnaround: 'Most jobs finished inside the first hour',
    related: [
      'virus-malware-and-spyware-removal-brisbane',
      'data-recovery',
      'pc-optimization-faster-overall-speed',
      'computer-upgrade',
      'pc-health-check',
    ],
    intro: [
      'Your computer is the thing standing between you and everything else you need to do - banking, schoolwork, running the business from the kitchen table, keeping in touch with family. When it dies, you are not interested in jargon or a three-hour estimate. You want it working.',
      'That is the whole job. I am a one-person outfit, so the person who answers the phone is the person who turns up, and the person who turns up is the person who fixes it. There is no call centre, no junior tech, no upsell.',
    ],
    sections: [
      {
        h: 'What a flat $150 covers',
        p: [
          'The rate is for the job, not the hour on a timesheet. I have deliberately kept the standard job list inside one visit so most problems are gone before I leave:',
        ],
        list: [
          'Diagnosing the fault and explaining it in plain English',
          'File clean-up and registry repair',
          'Fixing slow start-up',
          'Removing junk programs and nagging pop-up windows',
          'Removing virus and spyware infections',
          'Removing browser hijackers such as Snapdo',
          'General PC optimisation for faster overall speed',
          'Checking and repairing internet, email and printing',
        ],
      },
      {
        h: 'What it costs',
        p: [
          '**$150 for the first hour**, then work continues in 15-minute blocks. Most problems are fixed inside that first hour.',
          '**No call-out fee. No weekend or public holiday surcharge.** GST is included for home users and excluded for businesses. If I cannot fix it, you do not pay.',
          '**Parts are charged at cost, with no mark-up.** If a part needs replacing you get the invoice price, and I will tell you before anything is ordered.',
        ],
      },
      {
        h: 'How the visit works',
        p: [
          'I come to your home or office in {suburb} at a time that suits you - early mornings, evenings, weekends and public holidays are all normal. You watch the work if you want to.',
          'For anything heavier I take the machine back to the workshop. There I have the fast connection and the bench, so downloads and scans do not eat into your monthly data allowance. The charge is agreed before I start, and I will call you with every step. When it is done I bring it back, plug everything in and check internet, email and printing actually work before I leave.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How much does a computer repair cost?',
        a: 'The flat onsite rate is $150 for the first hour, then work continues in 15-minute blocks. There is no call-out fee and no surcharge for weekends or public holidays. Most problems are fixed inside the first hour. GST is included for home users.',
      },
      {
        q: 'Do you charge a call-out fee?',
        a: 'No. The $150 covers the visit and the first hour of work. There is no separate travel charge, anywhere in the Brisbane, Logan or Ipswich area.',
      },
      {
        q: 'Can you fix my computer in one visit?',
        a: 'Most faults can be. The standard job list - viruses, slow performance, junk programs, pop-ups, registry problems - is deliberately sized to fit one visit. If a part has failed and needs ordering, that is the main reason a second visit happens, and I will tell you upfront.',
      },
      {
        q: 'What happens if you cannot fix it?',
        a: 'You do not pay. If the fault is beyond repair or beyond what is worth repairing, I will tell you that straight rather than charging you to find out.',
      },
    ],
    suburbSections: [
      {
        h: 'Computer repairs in {suburb}',
        p: [
          '{suburb} is {postcodeLine}. I service the whole area on the same flat rate as everywhere else in Brisbane - the rate does not change with the suburb, the distance or the day of the week.',
          'Most {suburb} jobs are the usual suspects: a machine that has got slower every year, a desktop that will not finish booting, a laptop that overheats and shuts itself down, a browser that has been taken over by pop-ups, or a new computer that has not been set up properly yet.',
        ],
      },
    ],
  },
  {
    slug: 'pc-repairs',
    title: 'PC Repairs',
    shortTitle: 'PC Repairs',
    metaTitle: 'PC Repairs {suburb} Brisbane | Desktop Specialists',
    metaDescription:
      'Desktop PC repairs in {suburb} and Brisbane. Hardware and software faults, $150 flat rate, no call-out fee. Brands including HP, Dell, Lenovo, Asus. Call (07) 3155 2051.',
    summary:
      'Desktop PC repair - hardware faults, failed drives, power supplies, motherboards, and the software problems that masquerade as hardware ones.',
    icon: 'desktop',
    suburbPrefix: 'pc-repairs',
    suburbHasPostcode: true,
    noun: 'PC repairs',
    turnaround: 'Most faults diagnosed and fixed on the first visit',
    related: [
      'pc-repairs-brisbane',
      'pc-optimization-faster-overall-speed',
      'computer-upgrade',
      'data-recovery',
    ],
    intro: [
      'A desktop is the easiest thing to fix and the easiest thing to get wrong. People spend good money replacing a machine that needed a clean, a new drive, or one reseated memory stick.',
      'I fix desktops for a living and I work on every brand - HP, Dell, Lenovo, Asus, Acer, Toshiba, Compaq, Sony and the rest. I start by working out what is actually wrong, then I tell you what it will take to fix.',
    ],
    sections: [
      {
        h: 'Desktop faults I fix',
        p: ['These cover most of what comes through the door:'],
        list: [
          'Won’t power on, or powers on then dies straight away',
          'No display - bad graphics card, failed cable, or a dead monitor port',
          'Random restarts and shutdowns, usually power supply or overheating',
          'Failing hard drive, SSD or optical drive',
          'Noisy fans, dust build-up and thermal shutdowns',
          'Failed power supply or battery',
          'RAM faults and memory errors',
          'Motherboard-level faults that are not worth chasing',
          'Operating system failures, boot loops and missing drivers',
          'Adding or upgrading RAM, drives and graphics cards',
        ],
      },
      {
        h: 'Repairs versus replacement',
        p: [
          'A desktop is worth repairing when the case, power supply and motherboard are still sound - which is most of them. It is not worth repairing when the motherboard has taken liquid damage, or when the machine is so old that parts are no longer made.',
          'I will tell you which one you are looking at before you spend anything, and I will tell you if the repair costs more than a comparable replacement would.',
        ],
      },
      {
        h: 'Upgrades while I am there',
        p: [
          'If a repair is under way it is worth asking about a couple of cheap upgrades at the same time, because the labour is already paid for. The two that make the biggest difference on an older desktop are more RAM and a solid-state drive - together they usually do more for a five-year-old machine than anything else you can buy.',
          'Parts come at cost with no mark-up.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Do you repair all desktop brands?',
        a: 'Yes - HP, Dell, Lenovo, Asus, Acer, Toshiba, Sony, Compaq, IBM and the rest, plus generic and white-box builds. If it runs Windows I can work on it.',
      },
      {
        q: 'Is it worth repairing an old desktop?',
        a: 'Often, yes. Adding RAM and replacing a mechanical hard drive with a solid-state drive is usually the single biggest speed improvement available on an older machine, and I can quote both as part of one visit.',
      },
      {
        q: 'My PC will not turn on at all. Is that a motherboard problem?',
        a: 'Not necessarily. No power at all is usually the power supply, the cable, or the power button. I test the supply first because it is the cheapest and most common cause. A failed motherboard is genuinely a write-off in most cases, and I will say so rather than charge you to diagnose it.',
      },
      {
        q: 'Do you supply parts?',
        a: 'Yes, at cost with no mark-up. I will show you the invoice price before anything is ordered.',
      },
    ],
    suburbSections: [
      {
        h: 'Desktop PC repairs in {suburb}',
        p: [
          'I repair desktops in {suburb} {postcodeLine}. Desktops are the machines I do most of the work on, and the difference between a machine that is worth repairing and one that is not is obvious within the first half hour.',
        ],
      },
    ],
  },
  {
    slug: 'mac-repairs',
    title: 'Mac Repairs',
    shortTitle: 'Mac Repairs',
    metaTitle: 'Mac Repairs {suburb} Brisbane | iMac & MacBook Specialists',
    metaDescription:
      'Mac and iMac repairs in {suburb} and Brisbane. Logic boards, screens, batteries, liquid damage, macOS problems. Fixed at your home. Call (07) 3155 2051.',
    summary:
      'MacBook, iMac and Mac mini repair - screens, batteries, liquid damage, logic boards and the software problems that make Macs feel slow.',
    icon: 'apple',
    suburbPrefix: 'mac-repairs',
    suburbHasPostcode: true,
    noun: 'Mac repairs',
    turnaround: 'Same-day in most cases; board-level work quoted first',
    related: [
      'apple-mac-repairs-brisbane',
      'data-recovery',
      'computer-setup',
      'remote-support',
    ],
    intro: [
      'Macs fail in a small number of predictable ways, and most of them are fixable. A MacBook that will not charge, an iMac with a black screen, a keyboard where keys no longer register, a trackpad that has stopped clicking - these are all common, and all fixable at your home.',
      'I work on MacBooks, MacBooks Pros, iMacs and Mac minis, on both Intel and Apple silicon.',
    ],
    sections: [
      {
        h: 'Common Mac faults',
        p: ['The ones I see most often:'],
        list: [
          'Liquid damage - coffee, wine, a full water bottle in the bag',
          'Screens: cracked glass, black screens, dead backlights, vertical or horizontal lines',
          'Batteries that drain fast, swell, or will not charge at all',
          'Keyboards with dead keys, and trackpads that no longer click',
          'Macs that will not power on, or that shut down under load',
          'Fan noise and thermal throttling, especially in older Air models',
          'Slow performance after a macOS update - often very fixable',
          'Storage full errors, and failing SSDs',
          'Ports and charging ports worn out from cable use',
          'iMacs with no signal after a power surge',
        ],
      },
      {
        h: 'Board-level work',
        p: [
          'Some faults are on the logic board rather than in a replaceable part - a dead charging circuit, a blown fuse, a failed power rail. Not every Mac board is worth attempting, and the ones that are usually need a decision quickly because the value of the machine drops the longer you wait.',
          'I assess the board, tell you whether it is worth doing, and quote before starting. If it is not worth doing I will tell you that instead of taking the money.',
        ],
      },
      {
        h: 'What I will not do',
        p: [
          'I do not bypass Apple activation lock or iCloud locks, and I will not touch a FileVault-encrypted disk that I cannot unlock. Those are theft protections working as intended, and helping to defeat them is not something I do.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can liquid-damaged Macs be saved?',
        a: 'Often, yes, and the sooner you power it down the better. Corrosion keeps working while the machine is on. Bring the power in and let me look - I will tell you straight away if it is not worth pursuing.',
      },
      {
        q: 'Do you repair Apple silicon Macs?',
        a: 'Yes. Apple silicon is actually more reliable than the older Intel models, and screen, battery, keyboard and trackpad replacements are all things I do at your home.',
      },
      {
        q: 'My Mac has got slow after an update. Can that be fixed?',
        a: 'Usually. Slowdowns after a macOS update are commonly indexing, a full disk, too many login items or a background maintenance process still running. None of that is a hardware problem.',
      },
      {
        q: 'Will you use non-Apple parts?',
        a: 'Where a genuine part is available and reasonable I will use it. Where it is not, I will explain the trade-off and let you decide - I do not quietly fit a part and hope it holds.',
      },
    ],
    suburbSections: [
      {
        h: 'Mac repairs in {suburb}',
        p: [
          'I repair Macs in {suburb} {postcodeLine}, at your home or office. No courier, no drop-off to a service centre that takes two weeks, no wondering whether it is fixed yet.',
        ],
      },
    ],
  },
  {
    slug: 'laptop-repairs',
    title: 'Laptop Repairs',
    shortTitle: 'Laptop Repairs',
    metaTitle: 'Laptop Repairs {suburb} Brisbane | Fixed At Your Home',
    metaDescription:
      'Laptop repairs in {suburb} and Brisbane. Cracked screens, dead batteries, liquid damage, overheating, hard drive and SSD replacement. $150 flat rate. Call (07) 3155 2051.',
    summary:
      'Laptop screen, battery, keyboard and liquid damage repair, plus hard drive and SSD replacement - done at your home or office.',
    icon: 'laptop',
    suburbPrefix: 'laptop-repairs',
    suburbHasPostcode: false,
    noun: 'laptop repairs',
    turnaround: 'Screens and batteries same-day if the part is in stock',
    related: [
      'computer-setup',
      'computer-upgrade',
      'data-recovery',
      'file-clean-registry-repair',
    ],
    intro: [
      'A laptop is harder to live without than a desktop, which is why the promise here is simple: I come to you. No courier, no drop-off, no week without your machine.',
      'Most laptop repairs are screens, batteries and keyboards. All three are usually same-day if the part is on the van.',
    ],
    sections: [
      {
        h: 'Laptop repairs I do',
        p: ['Laptops get carried around and get dropped, so this is a long list:'],
        list: [
          'Cracked or shattered screens - LCD and LED panels',
          'No display, no backlight, flickering or dead pixels',
          'Batteries that will not charge, drain in an hour, or have swollen',
          'Dead keyboards, missing keys, unresponsive trackpads',
          'Liquid damage from spills',
          'Charging ports worn out from cable strain',
          'Laptops that overheat, throttle and shut themselves down',
          'Slow hard drives replaced with SSDs - the biggest single improvement',
          'Failed hard drives and data recovery from failing drives',
          'Wi-Fi, Bluetooth and network problems',
          'Fan, hinge and chassis repairs',
          'New operating system installs on machines that will not boot',
        ],
      },
      {
        h: 'SSDs are the single best upgrade',
        p: [
          'If a laptop is slow and takes a minute or two to start, a mechanical hard drive is almost always the reason. Swapping it for a solid-state drive is the cheapest, most noticeable improvement you can make to an otherwise healthy machine, and it takes about twenty minutes.',
          'I can also copy your files across so you do not lose anything.',
        ],
      },
      {
        h: 'Brands',
        p: [
          'HP, Lenovo, Dell, Apple, Asus, Sony, Toshiba, Acer, Compaq, and the rest. Parts for older models get harder to find, and I will tell you early if that is the situation rather than after ordering the wrong one.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can you repair a cracked laptop screen at my house?',
        a: 'Yes. Screen replacement is the most common laptop job I do, and it is done at your home or office. It is same-day if the panel is in stock, and I will tell you if it is not before I start.',
      },
      {
        q: 'My laptop battery is swollen. Is it dangerous?',
        a: 'Stop using it and stop charging it. A swollen battery can damage the chassis and in rare cases is a fire risk. Bring it to me and I will replace it. Do not puncture or crush it.',
      },
      {
        q: 'How long does a laptop repair take?',
        a: 'Most repairs are same-day when the part is available. A hard drive or SSD replacement takes about twenty minutes. If a part has to be ordered, I will tell you the wait and you can decide whether to wait or keep using the machine as it is.',
      },
      {
        q: 'Can you recover data from a dead laptop?',
        a: 'Often, yes - from a laptop that will not boot, that has a clicking drive, or that has suffered liquid damage. See the data recovery page for what is and is not recoverable.',
      },
    ],
    suburbSections: [
      {
        h: 'Laptop repairs in {suburb}',
        p: [
          'I repair laptops in {suburb} {postcodeLine}, at your home or office, so you are not without your machine for a week.',
        ],
      },
    ],
  },
];

/** Standalone service pages - one question, one page. */
export const services: Service[] = [
  {
    slug: 'virus-malware-and-spyware-removal-brisbane',
    title: 'Virus & Malware Removal',
    shortTitle: 'Virus Removal',
    metaTitle: 'Virus & Malware Removal Brisbane | $129 Flat Rate',
    metaDescription:
      'Computer virus, malware and spyware removal in Brisbane. $129 flat, cleaned at your home, includes a fresh scan and browser repair. Call (07) 3155 2051.',
    summary:
      'Virus, malware, ransomware and spyware removal, with the browser put back the way it should be afterwards.',
    icon: 'shield',
    price: 129,
    turnaround: 'Same-day in most cases, two to three hours at your home',
    intro: [
      'If your computer has slowed to a crawl, every page is full of adverts you did not ask for, or your files have turned into shortcuts to something you do not recognise, you have malware. It is common, it is fixable, and the price does not depend on how badly it has got.',
      'I remove it at your home. You watch it happen, which matters more than it sounds - a lot of people who get quoted for a clean machine have never been shown what came off it.',
    ],
    sections: [
      {
        h: 'Symptoms worth calling about',
        list: [
          'Browser home page and search engine keep reverting',
          'Ads and pop-ups that appear even with the browser closed',
          'Webpages redirecting to sites you did not click',
          'A desktop or start menu full of icons you did not put there',
          'Windows Update or antivirus refusing to run',
          'Fan running constantly, machine hot, or shutting down mid-task',
          'Files renamed or encrypted, with a note demanding payment',
          'A security warning saying your system is infected',
        ],
      },
      {
        h: 'What $129 covers',
        p: [
          'A full scan of every drive, a second opinion scan from a different engine, manual removal of anything the scanners cannot shift, and - this is the part most people have never had done - a repair of the browser itself. Left alone, a machine that has had an infection keeps redirecting and keeps re-infecting.',
          'Also included: checking that your antivirus is actually running and current, checking that Windows Update works, and removing the trial junk and bundled programs that are there to re-install the thing that infected you in the first place.',
        ],
      },
      {
        h: 'If you have been hit by ransomware',
        p: [
          'Do not pay it, and do not wipe anything yet. Encrypted files are sometimes recoverable, and the decision about what to restore from backup is easier to make before you have deleted the evidence.',
          'Disconnect the machine from the network - do not leave it plugged in - and call. Same-day, and I will tell you honestly whether the files are coming back.',
        ],
      },
      {
        h: 'After the clean',
        p: [
          'You get the list of what was removed, in writing, so you can see whether any of it was something you installed deliberately. I also tighten up the settings that let it in, and tell you the two or three habits that stop it happening again.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How do I know if I have a virus?',
        a: 'Pop-ups on pages you did not request, a browser home page that will not stay where you set it, sudden slowdowns, constant fan noise, or a security warning that appears on its own. Any of those is worth a look.',
      },
      {
        q: 'My antivirus says everything is fine but the computer is still bad. Why?',
        a: 'Often because the real problem is not malware. It can be a full disk, too many startup programs, a failing hard drive, or a browser extension that a scan will never flag. I look at the actual behaviour rather than trusting the scan.',
      },
      {
        q: 'Do you remove browser hijackers?',
        a: 'Yes - including Snapdo and similar. This is a redirect and ad-injection problem rather than a traditional virus, and it needs the browser and its extensions cleaned out rather than a virus scan.',
      },
      {
        q: 'Will everything I do on my computer be safe afterwards?',
        a: 'The machine will be clean and protected. I will also go through the settings that matter and the habits worth changing. Anything you entered on a compromised machine - banking passwords, especially - is worth changing from a different device.',
      },
    ],
    related: ['removal-spyware-infections', 'pc-optimization-faster-overall-speed', 'computer-repairs', 'network-setup'],
  },
  {
    slug: 'removal-spyware-infections',
    title: 'Spyware Removal',
    shortTitle: 'Spyware',
    metaTitle: 'Spyware Removal Brisbane | Discreet, Done At Your Home',
    metaDescription:
      'Spyware and stalkerware removal in Brisbane. Unusual data use, strange logins, tracking software and monitoring apps removed. $129 flat rate. Call (07) 3155 2051.',
    summary:
      'Spyware, stalkerware and monitoring apps removed, with an explanation of how it got there and how to stop it returning.',
    icon: 'shield',
    price: 129,
    turnaround: 'Same-day, two to three hours at your home',
    intro: [
      'Spyware is different from a virus. A virus is clumsy and makes itself obvious. Spyware is designed not to be noticed, and the people most likely to be targeted by it are the ones who would not think to look.',
      'I remove it, and I will show you what was there. If you suspected someone was watching the machine, you are entitled to know what I found and where it was hiding.',
    ],
    sections: [
      {
        h: 'Signs something is watching',
        list: [
          'A webcam light on when nothing is using it',
          'Data usage far higher than normal on a plan you did not change',
          'Browser extensions you did not install and cannot remove',
          'A new search engine or homepage you did not set',
          'The computer warming up or the fan running at odd times',
          'Accounts being logged into without you',
          'Battery on a laptop draining far faster than normal',
          'Someone who knows details they should not know',
        ],
      },
      {
        h: 'What I look for',
        p: [
          'Legitimate monitoring apps are a genuine grey area, so I check for them honestly rather than guessing. Stalkerware, keyloggers, remote-access tools installed without your knowledge, rogue browser extensions, hidden admin accounts, scheduled tasks that phone home, and unauthorised entries in the registry and startup list.',
        ],
      },
      {
        h: 'What you get',
        list: [
          'Everything found, named, and where it was hiding',
          'A written summary you can keep',
          'Removal of the software and the persistence that restarts it',
          'Password changes recommended for anything entered on the machine',
          'Advice on the specific route it came in - usually a cracked program, a fake update, or a link in a message',
        ],
      },
    ],
    faqs: [
      {
        q: 'How do I know if my computer has spyware on it?',
        a: 'Watch for unexplained data usage, a webcam light on when nothing is using it, browser extensions you did not install, and accounts being accessed without you. Those are the usual signs, though the only reliable way to know is to look.',
      },
      {
        q: 'Will you tell me what you find even if it is awkward?',
        a: 'Yes. If I find monitoring software I will show you exactly what it was, what it recorded, and where it was hiding. You are entitled to that information.',
      },
      {
        q: 'Do I need to replace my router?',
        a: 'Usually not. Most of it gets in through software on the computer, not the network. I will tell you if I find something that changes that answer.',
      },
    ],
    related: ['virus-malware-and-spyware-removal-brisbane', 'computer-repairs', 'pc-health-check', 'network-setup'],
  },
  {
    slug: 'removal-nagging-pop-windows',
    title: 'Pop-up & Adware Removal',
    shortTitle: 'Pop-ups',
    metaTitle: 'Pop-up & Adware Removal Brisbane | Ads, Redirects, Tabs',
    metaDescription:
      'Remove pop-ups, ads, fake virus warnings and browser redirects in Brisbane. Browser hijackers like Snapdo removed for $129. Call (07) 3155 2051.',
    summary:
      'Pop-ups, ads on every page, fake virus warnings and browser redirects - removed, along with the extensions that keep reinstalling them.',
    icon: 'sparkle',
    price: 129,
    turnaround: 'Usually under two hours at your home',
    intro: [
      'Ads on every page. A tab that opens by itself. A warning saying your computer is infected, with a phone number to call. Pages that go somewhere you did not click. None of it is a traditional virus, and a standard antivirus scan will usually clear it as clean.',
      'It is a browser problem, and it is fixed by repairing the browser rather than reinstalling Windows and hoping.',
    ],
    sections: [
      {
        h: 'What gets removed',
        list: [
          'Pop-ups that appear with no browser open',
          'Advertisements injected into search results and ordinary pages',
          'Fake virus and security warnings designed to frighten you into calling',
          'Browser hijackers such as Snapdo that force your homepage and search engine',
          'Extensions and add-ons that were installed without your permission',
          'New toolbars and search boxes that keep reappearing after you remove them',
          'Notification permission abuse - sites that spam you with "notifications"',
          'Search results redirecting to a different engine you never chose',
        ],
      },
      {
        h: 'Why it keeps coming back',
        p: [
          'Because removing the visible symptom does nothing about what reinstalls it. The usual chain is a cracked program, a bundled "free" tool, or an extension installed from a pop-up you clicked to close.',
          'I remove all of it in one pass and then find the thing that put it there, which is the only way it does not come back in three weeks.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Are these pop-ups a virus?',
        a: 'Usually not - it is adware or a browser hijacker. It behaves like malware and it is equally unwelcome, but it needs a different fix. I will tell you which one you have.',
      },
      {
        q: 'I have removed extensions myself and they come back. Why?',
        a: 'Because the thing reinstalling them is still there - usually a leftover program, a scheduled task, or a malicious preference in the browser profile. It needs a proper clean rather than another round of removing extensions.',
      },
      {
        q: 'Do I need a new computer?',
        a: 'Almost certainly not. This is a software problem and it gets fixed without touching the hardware.',
      },
    ],
    related: ['virus-malware-and-spyware-removal-brisbane', 'browser-clean-and-hijack-repair', 'pc-optimization-faster-overall-speed', 'computer-repairs'],
  },
  {
    slug: 'browser-clean-and-hijack-repair',
    title: 'Browser Clean & Hijack Repair',
    shortTitle: 'Browser Repair',
    metaTitle: 'Browser Hijack Repair Brisbane | Homepage & Search Reset',
    metaDescription:
      'Browser hijacker removal in Brisbane. Snapdo and similar, forced homepages, redirected searches and unwanted extensions removed. $129 flat. Call (07) 3155 2051.',
    summary:
      'Forced homepages, redirected searches and unwanted extensions reset to a clean state, with the installer that put them there removed.',
    icon: 'refresh',
    turnaround: 'Under two hours at your home',
    intro: [
      'A hijacked browser is one where something else has taken control: your homepage resets itself, your searches go somewhere you did not choose, or a toolbar you never installed keeps coming back.',
      'It is separate from a virus and it needs a separate fix. I put the browser back the way it should be and remove whatever installed itself in the first place.',
    ],
    sections: [
      {
        h: 'What gets reset',
        list: [
          'Homepage and new-tab page set back to your choice',
          'Default search engine restored',
          'Hijacked extensions and add-ons removed, including forced ones',
          'Unwanted toolbars and sidebars',
          'Redirects on the address bar',
          'Search result redirects',
          'Notification permissions that were granted to sites without you knowing',
          'The program or task that reinstalls the above',
        ],
      },
      {
        h: 'Every browser, and more than one',
        p: [
          'Chrome, Edge, Firefox, Safari and Internet Explorer all get worked on. If a machine has three browsers with the same hijack in each, they all get cleaned in the one visit rather than one per appointment.',
        ],
      },
    ],
    faqs: [
      {
        q: 'What is Snapdo?',
        a: 'A browser hijacker that changes your homepage and search engine, injects ads into search results, and reinstalls itself. It is not a virus but it behaves like one and it is easily removed properly.',
      },
      {
        q: 'Can my browser be repaired without reinstalling Windows?',
        a: 'Yes, and that is normally what I do. Reinstalling Windows is a last resort and it means re-setting up everything you have on the machine.',
      },
      {
        q: 'How do I stop it coming back?',
        a: 'Do not install programs from pop-ups, do not install "free" bundled software, and do not search for the tool you want through a hijacked search engine. All three are the usual entry route.',
      },
    ],
    related: ['removal-nagging-pop-windows', 'virus-malware-and-spyware-removal-brisbane', 'junk-program-removal', 'computer-repairs'],
  },
  {
    slug: 'junk-program-removal',
    title: 'Junk Program Removal',
    shortTitle: 'Junk Removal',
    metaTitle: 'Junk Program Removal Brisbane | Bloatware Cleanup',
    metaDescription:
      'Remove trial software, bloatware, bundled toolbars and unwanted startup programs in Brisbane. A clean machine without a Windows reinstall. $129 flat. Call (07) 3155 2051.',
    summary:
      'Trial software, bloatware and bundled junk removed, with a look at what else is slowing the machine down.',
    icon: 'sparkle',
    price: 129,
    turnaround: 'Under two hours at your home',
    intro: [
      'Most new computers arrive with a pile of software nobody asked for and nobody will ever use. It sits in the background, some of it slows the machine down, and some of it is a security risk that was there on day one.',
      'I take it out, and I take out everything else that has quietly accumulated while the machine has been in use.',
    ],
    sections: [
      {
        h: 'What gets removed',
        list: [
          'Pre-installed trial versions that nag you to buy',
          'Bloatware the manufacturer loaded on a machine bought for the hardware',
          'Bundled "security" tools that are themselves advertising',
          'Toolbars and browser add-ons installed by software',
          'Programs you do not recognise from a list I show you',
          'Startup entries for software that no longer exists',
          'Scheduled tasks and tray icons that have no business being there',
        ],
      },
      {
        h: 'What I do not remove',
        p: [
          'Drivers, and anything Windows genuinely needs to work. I show you the list before I remove anything, so you can see the judgement calls rather than discovering them afterwards when half your programs have disappeared.',
        ],
      },
    ],
    faqs: [
      {
        q: 'My computer was slow straight out of the box. Is that normal?',
        a: 'No. It is a common setup on new machines - a lot of trial software, an antivirus you do not need running alongside a built-in one, and a disk that is nearly full of both.',
      },
      {
        q: 'Can I just get a clean reinstall of Windows instead?',
        a: 'Sometimes that is the right call, and I will say so. But it is a bigger hammer than most situations need, and it means reconfiguring everything. I try removal first.',
      },
      {
        q: 'Will removing software delete my files?',
        a: 'No. I show you the list before removing anything, and your documents and photos are not touched.',
      },
    ],
    related: ['pc-optimization-faster-overall-speed', 'windows-reinstallation', 'fix-slow-start', 'computer-repairs'],
  },
  {
    slug: 'file-clean-registry-repair',
    title: 'File Clean-Up & Registry Repair',
    shortTitle: 'Cleanup',
    metaTitle: 'Computer Cleanup & Registry Repair Brisbane | Disk Space',
    metaDescription:
      'Disk clean-up and registry repair in Brisbane. Reclaim gigabytes of space, fix invalid startup entries and errors. $129 flat rate. Call (07) 3155 2051.',
    summary:
      'Disk clean-up, temporary file removal and registry repair - reclaiming space and fixing the errors a slow machine accumulates.',
    icon: 'wrench',
    price: 129,
    turnaround: 'One visit, two to three hours',
    intro: [
      'A computer gets slower over the years in a fairly predictable way: temporary files accumulate, the disk fills, programs you deleted leave entries behind, and the startup list grows every time something installs itself.',
      'This is the housekeeping that reverses it. No reinstall, no lost files, no afternoon of wondering what went wrong.',
    ],
    sections: [
      {
        h: 'What gets cleaned',
        list: [
          'Temporary files, update leftovers and install caches',
          'Old restore points beyond the ones that are worth keeping',
          'Recycle bin and thumbnail caches',
          'Registry entries pointing at software and files that no longer exist',
          'Invalid startup entries left by uninstalled programs',
          'Duplicate and orphaned file references',
          'Log files and crash dumps that serve no purpose after the fact',
        ],
      },
      {
        h: 'Before and after',
        p: [
          'I measure free space and boot time before I start and again afterwards, so you get actual numbers rather than an opinion. On a machine that has not been cleaned in a few years the difference is usually not subtle.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is it safe to clean the registry?',
        a: 'Done properly, yes - and it is the wrong entries being removed that cause problems, not the act of cleaning. I take a backup first, so anything I change can be put back.',
      },
      {
        q: 'How much space will I get back?',
        a: 'On a machine that has run for a few years without attention, often several gigabytes. I measure before and after so you will know the real figure for your machine.',
      },
      {
        q: 'Will I lose any of my files?',
        a: 'No. Only temporary files, caches and system leftovers. Your documents, photos and downloads are not touched.',
      },
    ],
    related: ['fix-slow-start', 'pc-optimization-faster-overall-speed', 'junk-program-removal', 'windows-reinstallation'],
  },
  {
    slug: 'pc-optimization-faster-overall-speed',
    title: 'PC Speed-Up & Optimisation',
    shortTitle: 'Speed Up',
    metaTitle: 'PC Speed Up Brisbane | Optimisation & Tuning Service',
    metaDescription:
      'Slow computer? Speed up your PC in Brisbane. Startup, services, disk, drivers and thermal tuning. $129 flat rate, measured before and after. Call (07) 3155 2051.',
    summary:
      'Everything slowing a machine down, found and fixed - startup, services, disk, drivers and thermals - with before-and-after timings.',
    icon: 'gauge',
    price: 129,
    turnaround: 'One visit, two to three hours',
    intro: [
      '"It has got slow" is the most common thing I am told, and it is almost never one thing. Usually it is four or five things at once, which is why the one-click speed-up utilities people buy never seem to help for long.',
      'This is the whole job: find everything that is making the machine slow, fix all of it, and show you the numbers before and after.',
    ],
    sections: [
      {
        h: 'What I check',
        list: [
          'What is actually running at start-up, and whether it needs to',
          'Services and scheduled tasks set to start that have no business doing so',
          'Disk health, fragmentation and free space',
          'Whether a mechanical hard drive is holding the machine back - usually it is',
          'Driver versions, particularly graphics and chipset',
          'Whether the machine is overheating and throttling',
          'Memory use and whether anything is leaking it',
          'Updates that are pending and blocked',
          'The Windows installation itself - a badly installed OS is slow no matter what you do',
        ],
      },
      {
        h: 'The honest recommendation',
        p: [
          'If the machine has a mechanical hard drive, replacing it with a solid-state drive will beat everything else on this list combined, and it costs less than most people expect. I will tell you that before I start rather than doing an hour of tuning a machine that needed a new drive.',
          'And if the machine is old enough that tuning will not make it feel new again, I will say that too. A second opinion you can trust is worth more than a sale.',
        ],
      },
    ],
    faqs: [
      {
        q: 'What is the single biggest speed improvement?',
        a: 'Replacing a mechanical hard drive with a solid-state drive. On an older machine it is usually more noticeable than every other thing combined, and it takes about twenty minutes.',
      },
      {
        q: 'Do I need to reinstall Windows?',
        a: 'Sometimes. If the operating system itself is badly damaged or a decade of accumulated software is on it, a clean install genuinely is the fastest route. I will tell you if I think that is the case rather than tuning a machine past the point of usefulness.',
      },
      {
        q: 'How do you know it worked?',
        a: 'I record boot time and a few standard timings before and after, and you get both numbers. No vague claims that it "feels better".',
      },
    ],
    related: ['fix-slow-start', 'file-clean-registry-repair', 'computer-upgrade', 'computer-maintenance'],
  },
  {
    slug: 'fix-slow-start',
    title: 'Fix Slow Start-Up',
    shortTitle: 'Slow Start',
    metaTitle: 'Fix Slow Computer Startup | Brisbane Computer Repair',
    metaDescription:
      'Computer takes forever to start? Slow boot-up fixed in Brisbane. Startup programs, update backlog and disk health investigated. $129 flat. Call (07) 3155 2051.',
    summary:
      'The long wait between pressing the power button and being able to work, and what is causing it.',
    icon: 'rocket',
    price: 129,
    turnaround: 'One visit, two to three hours',
    intro: [
      'Pressing the power button and then making a coffee, several times a day, for years. That is not a normal state of affairs and it is fixable.',
      'Startup problems are usually a combination of too many programs, a pending update backlog, and a slow drive. All three are fixable in one visit.',
    ],
    sections: [
      {
        h: 'What makes a slow boot',
        list: [
          'Startup programs that do not need to start with Windows',
          'A backlog of failed or pending Windows updates that retry on every boot',
          'A mechanical hard drive - by far the most common single cause',
          'Too many services running as local system',
          'Antivirus software scanning everything at start-up',
          'A disk that is nearly full, so Windows cannot create its swap properly',
          'A registry that has grown large over years of use',
          'Firmware or driver problems that make the hardware probe slowly',
        ],
      },
      {
        h: 'What I do about it',
        p: [
          'I watch the boot, list what is loading, and cut out what does not need to be there. I clear the update backlog. I check the disk and tell you if it needs replacing. Then I time it again.',
          'In most cases the machine goes from a minute-plus to a working desktop in well under that.',
        ],
      },
    ],
    faqs: [
      {
        q: 'My computer takes three minutes to start. Is it the hard drive?',
        a: 'Possibly. If it is a mechanical drive, replacing it with an SSD is the single biggest improvement available. But the update backlog and startup program list often account for a lot too, and those cost nothing to fix.',
      },
      {
        q: 'Is it safe to disable startup programs?',
        a: 'It is safe for most of them, and I do not guess. Some things genuinely need to start. I check what each one is and show you the list before changing anything.',
      },
      {
        q: 'My laptop takes ages to wake from sleep. Is that the same problem?',
        a: 'It is related but different - sleep problems are usually drivers and power management rather than the startup list. It is fixable, just by a different set of changes.',
      },
    ],
    related: ['pc-optimization-faster-overall-speed', 'file-clean-registry-repair', 'computer-upgrade', 'computer-maintenance'],
  },
  {
    slug: 'removal-web-site-redirection',
    title: 'Browser Redirect Removal',
    shortTitle: 'Redirects',
    metaTitle: 'Remove Website Redirection | Browser Redirect Fix Brisbane',
    metaDescription:
      'Searches and pages redirecting to the wrong site? Browser redirection removed in Brisbane, including the installer that causes it. $129 flat. Call (07) 3155 2051.',
    summary:
      'Searches, links and pages that redirect somewhere you did not ask for - removed at the source.',
    icon: 'refresh',
    price: 129,
    turnaround: 'Under two hours at your home',
    intro: [
      'You click a link or type a search and end up on a site you did not ask for. Sometimes it is a genuine site that is simply squatting on your search results. Sometimes it is malware, and the redirect is the payload.',
      'Either way it gets removed properly rather than worked around.',
    ],
    sections: [
      {
        h: 'The different kinds',
        p: ['These need different fixes, and it is worth knowing which you have:'],
        list: [
          'Search redirect - your searches are rerouted to another engine you did not choose',
          'Link redirect - a link goes somewhere other than where it says it goes',
          'Homepage hijack - the homepage is locked to a site you did not set',
          'New-tab redirect - a new tab opens something other than a page',
          'DNS hijack - the browser is fine but the machine resolves addresses wrongly',
          'Router-level hijack - every device on the network is affected, not just one computer',
        ],
      },
      {
        h: 'Checking the rest of the network',
        p: [
          'If the same redirects appear on your phone and tablet, it is not the computer. I check the router and the devices, because fixing one machine and leaving the rest compromised means it comes straight back.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is website redirection a virus?',
        a: 'Sometimes. A hijack installed by malware is a virus problem; a redirect baked into a search engine you chose is a configuration problem. I work out which before starting.',
      },
      {
        q: 'My phone is redirected too. Can you fix that?',
        a: 'I can check the router and the network settings, which is usually where that comes from. I cannot repair a phone, but I can tell you exactly what to change on it.',
      },
    ],
    related: ['browser-clean-and-hijack-repair', 'removal-nagging-pop-windows', 'network-setup', 'virus-malware-and-spyware-removal-brisbane'],
  },
  {
    slug: 'data-recovery',
    title: 'Data Recovery',
    shortTitle: 'Data Recovery',
    metaTitle: 'Data Recovery Brisbane | Recover Files From Failed Drives',
    metaDescription:
      'Data recovery in Brisbane from failed hard drives, dead laptops and deleted files. Diagnosis is free, no recovery, no fee. Call (07) 3155 2051.',
    summary:
      'Files recovered from failing drives, dead laptops and accidental deletions. No recovery, no fee.',
    icon: 'database',
    turnaround: 'Assessment same-day; recovery time depends on the fault',
    intro: [
      'The rule here is simple: if I cannot get the data back, you do not pay. I would rather do a free assessment and tell you honestly whether it is worth pursuing.',
      'The other rule is more important: bring the machine to me, and do not keep using it. Every minute a failing drive is powered, it is writing bad sectors over the top of the data you want.',
    ],
    sections: [
      {
        h: 'What is recoverable',
        p: [
          '**Usually:** a drive that has stopped being recognised; a laptop that will not boot after liquid damage; a drive making clicking or grinding noises; files deleted by mistake; a machine that worked until it did not, with no warning.',
          '**Sometimes:** a drive that fell off a desk, a full disk that will not format, an SSD that has failed, or files encrypted by ransomware.',
          '**Rarely, or never:** a drive that has been dropped and visibly damaged, data on a drive that has been wiped or overwritten, or anything where the previous owner already tried recovery tools.',
        ],
      },
      {
        h: 'What to do right now',
        p: [
          '**Stop using the machine.** If the drive is clicking, stop immediately - do not run any recovery software yourself.',
          '**Do not reformat, do not install Windows over it, do not "try it again".**',
          'If it is a desktop and the data is on a separate drive, you can leave the failed one powered off and use the rest of the machine.',
          'Bring it in. Diagnosis is free, and if it is not recoverable I will tell you in the first half hour so you are not paying for a month of hoping.',
        ],
      },
      {
        h: 'Getting your files back in the real world',
        p: [
          'Recovered files are a start, not an ending. Once a drive has failed once it will fail again, so I would rather set up a proper backup than leave you in the same position next year. Ask about it when you collect the files.',
        ],
      },
    ],
    faqs: [
      {
        q: 'My hard drive is clicking. Should I keep trying to read it?',
        a: 'No. Stop. A clicking drive is failing heads, and every power-on can destroy more of what is recoverable. Bring it in as-is.',
      },
      {
        q: 'Is there a charge if you cannot recover the data?',
        a: 'No. The assessment is free and if I cannot get the data back there is nothing to charge for. I would rather tell you that quickly.',
      },
      {
        q: 'Can you recover files from a phone or a camera?',
        a: 'Sometimes, yes - from a device that will not connect, or that was dropped in water. It depends entirely on whether the storage is still readable.',
      },
      {
        q: 'How long does recovery take?',
        a: 'The assessment is same-day. Recovery itself depends entirely on the fault - a deleted file can be back in minutes, a physically damaged drive can take a week or more, and I will give you a realistic timeframe when I have assessed it.',
      },
    ],
    related: ['computer-repairs', 'laptop-repairs', 'computer-upgrade', 'computer-maintenance'],
  },
  {
    slug: 'computer-setup',
    title: 'New Computer Setup',
    shortTitle: 'New Computer Setup',
    metaTitle: 'New Computer Setup & Data Transfer | Brisbane',
    metaDescription:
      'New computer setup in Brisbane. Data transferred from your old machine, email, printers, Wi-Fi and software all working. $150 flat rate. Call (07) 3155 2051.',
    summary:
      'New computers set up properly with your files, email, printers and software moved across, in one visit.',
    icon: 'sparkle',
    price: 150,
    turnaround: 'One visit, usually two to three hours',
    intro: [
      'A new computer arrives with a load of trial software, your email password typed in twice, and none of your files. Most people spend their first week with a new machine rediscovering things they already had.',
      'I set it up properly in one visit: everything transferred, everything working, and you shown how to use it.',
    ],
    sections: [
      {
        h: 'What gets set up',
        list: [
          'Windows updated and the junk software removed',
          'Your documents, photos and downloads moved from the old machine',
          'Email working, with the rules you want',
          'Printers, scanners and webcams',
          'Wi-Fi, and the wireless network set up properly',
          'Your software reinstalled and licensed',
          'Security software configured rather than left at defaults',
          'Backups set up, so the next failure is not another crisis',
          'A walkthrough of what is different, in language that is not jargon',
        ],
      },
      {
        h: 'Bringing the old machine',
        p: [
          'Bring both. Transferring files needs access to the old machine, and a copy is a safety net even if the transfer works perfectly.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can you move everything from my old computer?',
        a: 'Yes, that is most of the job. Documents, photos, downloads, browser bookmarks and passwords, email archives. I bring a hard drive so the transfer is a copy rather than a move, and the old machine keeps working until you are satisfied.',
      },
      {
        q: 'Do I need to buy anything else?',
        a: 'Usually not. If the machine you bought does not suit what you do, I will tell you before you have spent more money on the wrong computer.',
      },
      {
        q: 'How long does it take?',
        a: 'Usually two to three hours. Moving a lot of data, or a machine with a slow drive, takes longer.',
      },
    ],
    related: ['computer-upgrade', 'network-setup', 'computer-maintenance', 'computer-repairs'],
  },
  {
    slug: 'computer-upgrade',
    title: 'Computer Upgrades',
    shortTitle: 'Upgrades',
    metaTitle: 'Computer & PC Upgrades Brisbane | Parts At Cost',
    metaDescription:
      'PC and laptop upgrades in Brisbane. More RAM, solid-state drives, graphics cards. Parts at cost with no mark-up, installed at your home. Call (07) 3155 2051.',
    summary:
      'More memory, faster drives, better graphics - the upgrades that actually make a computer feel different.',
    icon: 'gauge',
    turnaround: 'Same-day if parts are in stock',
    intro: [
      'Most slow computers are slow because of one or two things, and both are cheap to fix. More memory, and a solid-state drive instead of a mechanical one. Together they usually do more for an older machine than anything else you could buy.',
      'Parts come at cost with no mark-up, and I fit them at your home so you are not hauling a desktop across town to have a card put in.',
    ],
    sections: [
      {
        h: 'The upgrades worth doing',
        p: [
          '**Solid-state drive.** The single biggest improvement. A machine that takes a minute to start starts in seconds. This is the one I recommend first.',
          '**More RAM.** Worth it if you have everything you do open at once - lots of browser tabs, email, a video call, documents. Below 8GB on a modern machine, that is where it hurts.',
          '**Graphics card.** Only if you play games or do graphics work. Not worth it for general use.',
          '**Clean reinstall alongside.** Sometimes the best upgrade is not new parts but a clean operating system on the hardware you already have. I will say so if that is the case.',
        ],
      },
      {
        h: 'What it costs',
        p: [
          'Parts are charged at cost, no mark-up, and I will show you the price before ordering. Labour is the same flat rate as any other visit.',
          'If an upgrade will not make a meaningful difference to your machine, I will say that instead of taking the money.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is it cheaper to upgrade than buy new?',
        a: 'Usually, for anything less than about five years old. Beyond that it depends on the machine. I will tell you which side of that line you are on rather than talking you into either one.',
      },
      {
        q: 'Do you charge mark-up on parts?',
        a: 'No. You pay the invoice price and you see it. Parts are the part I most often see inflated on a quote, so it is a standing policy here.',
      },
      {
        q: 'Can you upgrade a laptop?',
        a: 'RAM and storage on most models, yes. Graphics cards on laptops, almost never. I will tell you what your particular model allows before you spend anything.',
      },
    ],
    related: ['computer-setup', 'pc-optimization-faster-overall-speed', 'computer-maintenance', 'pc-repairs'],
  },
  {
    slug: 'pc-health-check',
    title: 'PC Health Check',
    shortTitle: 'Health Check',
    metaTitle: 'Computer Health Check Brisbane | $79, No Obligation',
    metaDescription:
      'A straight answer on whether your computer is worth fixing, upgrading or replacing. $79 health check, waived if you go ahead with the work. Call (07) 3155 2051.',
    summary:
      'A straight answer on whether your computer is worth fixing, upgrading or replacing - and what it will cost either way.',
    icon: 'check',
    price: 79,
    turnaround: 'About an hour at your home',
    intro: [
      'Most computer advice is worth taking, because the person giving it is being paid to sell you something. This is a fixed-fee check that ends with you knowing what your machine is actually worth.',
      'I go through the hardware, the storage, the memory, the temperatures and the operating system, and then tell you the options with prices. If the answer is "replace it", I will say replace it.',
    ],
    sections: [
      {
        h: 'What the check covers',
        list: [
          'Hardware health - disk, memory, battery, fans, temperatures',
          'Whether the machine is still supported by Windows',
          'How much life is realistically left in it',
          'What a repair would cost, and what an equivalent replacement would cost',
          'Which of those two makes more sense',
          'Any fixable problems worth doing regardless',
        ],
      },
      {
        h: 'What it costs',
        p: [
          '**$79, and it comes off the bill** if you go ahead with any work. So if I find something that needs doing, the check is free.',
          'If I tell you the machine is not worth repairing, the check still cost you $79 and you still have an answer you did not have before.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is this really independent advice?',
        a: 'That is the point of it, and the reason it is a separate paid service rather than something I offer while quoting for a repair. I have no reason to talk you into a repair I do not think is worth doing.',
      },
      {
        q: 'What if you say it needs replacing?',
        a: 'Then you know that, and I will tell you what to look for in a replacement. I do not sell hardware, so I have nothing to gain from that answer either way.',
      },
    ],
    related: ['pc-optimization-faster-overall-speed', 'computer-upgrade', 'computer-repairs', 'computer-maintenance'],
  },
  {
    slug: 'network-setup',
    title: 'Network & Wi-Fi Setup',
    shortTitle: 'Network Setup',
    metaTitle: 'Wireless & Network Setup Brisbane | Wi-Fi Problems Fixed',
    metaDescription:
      'Wi-Fi and network setup in Brisbane. Dead spots, slow wireless, printers on the network, and devices that will not connect. $79 flat. Call (07) 3155 2051.',
    summary:
      'Wi-Fi that does not reach, wireless that is slow, devices that will not connect, and printers that have gone off the network.',
    icon: 'network',
    price: 79,
    turnaround: 'One visit, usually under two hours',
    intro: [
      'The router works fine in the room it is in, and not much anywhere else. Or the wireless is slow even next to it. Or the printer worked last month.',
      'Most of this is placement, band congestion, or a router that is fine but badly configured. None of it needs new hardware, and all of it is fixable in one visit.',
    ],
    sections: [
      {
        h: 'What I fix',
        list: [
          'Dead spots and weak signal around the house',
          'Wireless that is slow despite a good plan',
          'Devices that will not connect, or keep dropping off',
          'Printing from anywhere in the house, including from a phone',
          'A router in the wrong place, or the wrong kind for the space',
          'Wi-Fi password set up on all the devices that need it',
          'Separate networks for guests and for the home network',
          'Parental controls',
          'Extending coverage where it is genuinely needed rather than everywhere',
        ],
      },
      {
        h: 'The honest part',
        p: [
          'A lot of wireless problems are solved by moving the router, and almost nobody does it. One metre out of a cupboard, off the floor, away from a metal appliance, is often the whole fix and it costs nothing.',
          'I will tell you when that is all it needs, before anyone suggests buying an expensive mesh system.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Do I need a mesh system?',
        a: 'Usually not. Extenders and mesh units are widely sold as the answer to dead spots, and often the actual problem is a router in a bad position or on the wrong band. I will check that first, and tell you honestly if hardware is genuinely needed.',
      },
      {
        q: 'Can I keep my existing router?',
        a: 'In most cases, yes. Repositioning it and changing a few settings fixes more than a new one does.',
      },
      {
        q: 'Can you set up printers and other devices?',
        a: 'Yes - printers, scanners, TVs, consoles, smart home devices, everything on the network. That is most of the visit.',
      },
    ],
    related: ['computer-setup', 'computer-maintenance', 'pc-health-check', 'computer-repairs'],
  },
  {
    slug: 'computer-maintenance',
    title: 'Computer Maintenance',
    shortTitle: 'Maintenance',
    metaTitle: 'Computer Maintenance Brisbane | Servicing & Tune Up',
    metaDescription:
      'Computer servicing and maintenance in Brisbane. Clean, updates, backups and a health check so the next failure is not a surprise. $150 flat rate. Call (07) 3155 2051.',
    summary:
      'Planned servicing - clean, updated, backed up and checked - so problems are found before they become failures.',
    icon: 'refresh',
    price: 150,
    turnaround: 'One visit, two to three hours',
    intro: [
      'A computer that gets a little attention every couple of years does not develop the same problems as one that gets none. Clean out the dust, update what is out of date, check the disk is healthy, and make sure the backup actually works.',
      'That is what this is, and it is the cheapest thing you can do to avoid a big repair later.',
    ],
    sections: [
      {
        h: 'What a service includes',
        list: [
          'Dust out - the single most effective thing and the one everyone skips',
          'Thermal check, and fan and heat-sink clean',
          'All software and Windows updates applied properly',
          'Startup and services reviewed',
          'Disk health checked, with an honest read on how long it will last',
          'Backups set up, and a restore actually tested',
          'Memory and memory leak check',
          'A written summary of anything worth watching',
        ],
      },
      {
        h: 'How often',
        p: [
          'Every two to three years for a desktop on a desk, more often if it is in a warm space or runs hot. Laptops need it less often for dust but benefit from the same service.',
          'This is what stops the "it just stopped working" call, which is always more expensive than the maintenance would have been.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Why does my computer get so hot?',
        a: 'Dust in the heat sinks and fans, which most people never clean and which every machine accumulates. It causes the noise, the shutdowns under load, and a good share of the sudden failures.',
      },
      {
        q: 'Do I really need a backup?',
        a: 'You need one. A drive that has worked for five years is not a drive that will work for six. I set it up and test a restore, because a backup you have never restored from is a hope, not a backup.',
      },
      {
        q: 'Can I do some of this myself?',
        a: 'The software half, some of it. The physical half - dust, thermal paste, fan health - needs the machine open, and doing it wrong can cost more than the service.',
      },
    ],
    related: ['computer-upgrade', 'pc-health-check', 'file-clean-registry-repair', 'pc-optimization-faster-overall-speed'],
  },
  {
    slug: 'windows-reinstallation',
    title: 'Windows Reinstallation',
    shortTitle: 'Windows Reinstall',
    metaTitle: 'Windows 11 Reinstall Brisbane | Clean Install With Data Kept',
    metaDescription:
      'Clean Windows reinstall in Brisbane. Full reset, drivers, updates and your files kept. $150 flat rate. Call (07) 3155 2051.',
    summary:
      'A clean Windows install with your files kept, drivers loaded and the bloatware left out this time.',
    icon: 'windows',
    price: 150,
    turnaround: 'Same-day in most cases',
    intro: [
      'Sometimes the operating system itself is the problem, and no amount of tuning fixes it. Error messages, a machine that has been reinstalled twice and still misbehaves, a hard drive full of errors, or just a build-up of years.',
      'A clean install fixes that, and I do it properly - not an in-place repair that leaves the problems underneath.',
    ],
    sections: [
      {
        h: 'When a reinstall is the right answer',
        list: [
          'The machine is slow and it has already been cleaned up',
          'It has been reinstalled before and the problem came back',
          'Registry damage or a system that will not install updates',
          'A virus that has done damage a cleanup cannot undo',
          'Frequent crashes, and a hardware check has come back clean',
          'A handover of a second-hand machine',
          'It simply needs to feel like it did on the first day',
        ],
      },
      {
        h: 'What gets kept',
        p: [
          'Your files. That is the part people worry about, and it should not be a concern - I copy everything to a drive first, install cleanly, and put it back.',
          'What does not get kept is the accumulated mess: trial software, startup clutter, registry bloat, the program that was causing the problem in the first place. That is the point.',
        ],
      },
      {
        h: 'What I install',
        p: [
          'The correct drivers, all the updates, security set up properly rather than left at defaults, and none of the trial software that comes on a new machine. I leave it in a state where the first thing you do is use it, not spend an afternoon turning things off.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Will I lose my files?',
        a: 'No. I copy everything to a drive before starting and restore it afterwards. If the disk is failing, that copy also becomes the backup, which you should be keeping anyway.',
      },
      {
        q: 'How long does it take?',
        a: 'Most reinstalls are done same-day. The machine does its part while updates and drivers run, and I come back to finish setting it up.',
      },
      {
        q: 'Is a reinstall better than buying a new computer?',
        a: 'Often, for anything under about five years old. If the hardware is not worth repairing I will tell you straight - there is no point reinstalling Windows on a machine that cannot keep up.',
      },
    ],
    related: ['pc-optimization-faster-overall-speed', 'junk-program-removal', 'data-recovery', 'computer-setup'],
  },
  {
    slug: 'remote-support',
    title: 'Remote Support',
    shortTitle: 'Remote Support',
    metaTitle: 'Remote Computer Support Brisbane | Watch It Happen',
    metaDescription:
      'Remote computer support in Brisbane. Connect over the internet, watch every step on your own screen, and disconnect when you say. $99 flat. Call (07) 3155 2051.',
    summary:
      'Fixed by connecting to your screen over the internet. You watch every step and disconnect whenever you want.',
    icon: 'support',
    price: 99,
    turnaround: 'Usually 30-60 minutes',
    intro: [
      'If the problem is straightforward, you may not need a visit at all. I can connect to your computer over the internet and fix it while you watch, on your own screen, the whole time.',
      'You are in control throughout. You approve each connection, you see everything, and you can disconnect at any moment.',
    ],
    sections: [
      {
        h: 'Good for',
        list: [
          'Pop-ups, adware, browser hijackers and redirects',
          'Email not working, or not sending',
          'Software that will not install or will not start',
          'Printer and network trouble',
          'Setting up a new printer, or a new device on the network',
          'General how-do questions, walked through with you',
          'Anything where the problem is a setting rather than a part',
        ],
      },
      {
        h: 'Not good for',
        p: [
          'Anything physical. A cracked screen, a dead drive, a machine that will not power on - those need hands on the hardware, and no amount of remote access changes that.',
          'I will tell you if remote is not the right answer instead of charging you to find out over a screen share.',
        ],
      },
      {
        h: 'How it is done',
        p: [
          'You download a small remote support tool, which is a well-known commercial product. You get a code and you type it in yourself - the connection only happens when you approve it.',
          'There is nothing running on your machine afterwards. I remove the tool when we are done.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is it safe to let someone onto my computer?',
        a: 'It is, and you keep control. You approve the connection, you see every action as it happens, and you can disconnect at any point. If you want me to stop, disconnecting ends the session immediately.',
      },
      {
        q: 'Can you do everything remotely?',
        a: 'No. Anything involving the hardware needs a visit. I will tell you straight away if remote is not going to be enough.',
      },
      {
        q: 'What does it cost?',
        a: '$99 flat, and most remote sessions take between thirty minutes and an hour.',
      },
    ],
    related: ['computer-repairs', 'network-setup', 'virus-malware-and-spyware-removal-brisbane', 'computer-setup'],
  },
  {
    slug: 'apple-mac-repairs-brisbane',
    title: 'Apple Mac Repairs Brisbane',
    shortTitle: 'Apple Repairs',
    metaTitle: 'Apple Mac Repairs Brisbane | MacBook, iMac & Mac mini',
    metaDescription:
      'Apple Mac repairs in Brisbane - MacBook, iMac and Mac mini. Liquid damage, screens, batteries, logic boards and macOS problems. Call (07) 3155 2051.',
    summary:
      'MacBook, iMac and Mac mini repair, from a cracked screen to a board that needs component-level work.',
    icon: 'apple',
    turnaround: 'Same-day for screens, batteries and keyboards',
    intro: [
      'Apple hardware is well made and well supported, and it still fails in a small number of predictable ways. All of them are fixable, and nearly all of them are fixable at your home rather than in a service centre.',
      'I work on Intel and Apple silicon, across MacBook, MacBook Pro, iMac and Mac mini.',
    ],
    sections: [
      {
        h: 'What I repair',
        list: [
          'Liquid damage, from coffee, wine or a bottle in the bag',
          'Screens - cracked panels, black screens, dead backlights, lines across the display',
          'Batteries - swollen, dead, or not charging',
          'Keyboards with dead keys, trackpads that do not click',
          'Machines that will not power on',
          'Fans and thermal throttling, especially in older Air models',
          'Slow performance after a macOS update',
          'Failing SSDs and storage full errors',
          'Charging ports worn out from cable strain',
          'Logic board faults - dead charging circuits, blown fuses, failed power rails',
        ],
      },
      {
        h: 'Apple parts and third-party parts',
        p: [
          'Where a genuine part is available and reasonably priced, I fit it. Where it is not - and for some older models it genuinely is not - I will explain what the alternative is and what the trade-off looks like, and let you decide.',
          'I do not quietly fit a part and hope it holds, and I do not fit anything without telling you first.',
        ],
      },
      {
        h: 'What I will not do',
        p: [
          'I will not bypass Activation Lock or iCloud locks, and I will not touch a FileVault-encrypted disk I cannot unlock. Those are theft protections doing their job.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Do you service the iMac?',
        a: 'Yes. iMacs develop a few predictable problems - failed backlights, a PSU that gives up, screens - and most are repairable. I come to you for iMacs rather than have you move one.',
      },
      {
        q: 'Is a liquid-damaged Mac beyond saving?',
        a: 'Not necessarily, and the sooner you switch it off the better, because corrosion keeps working while the machine is powered. Bring it in and I will assess it. If it is not worth doing I will tell you straight away.',
      },
      {
        q: 'Can you upgrade a Mac?',
        a: 'RAM and storage on the models that allow it. Most recent Macs have soldered storage and cannot be upgraded at all. I will tell you which category yours is in before you spend anything.',
      },
    ],
    related: ['mac-repairs', 'laptop-repairs', 'computer-repairs', 'data-recovery'],
  },
  {
    slug: 'pc-repairs-brisbane',
    title: 'Computer Repairs Brisbane',
    shortTitle: 'Brisbane Repairs',
    metaTitle: 'Computer Repairs Brisbane | $150 Flat Rate, 7 Days A Week',
    metaDescription:
      'Computer repairs across Brisbane, Logan and Ipswich. Flat $150, no call-out fee, no weekend surcharge. Ex-IBM help desk technician. Call (07) 3155 2051.',
    summary:
      'The full computer repair service across Brisbane, Logan and Ipswich - one flat rate, no call-out fee, seven days a week.',
    icon: 'wrench',
    price: 150,
    turnaround: 'Most jobs finished inside the first hour',
    intro: [
      'One person, one flat rate, and no call centre. I answer the phone, I drive out, and I fix the computer.',
      'The rate is $150 for the first hour and most problems are gone inside it. No call-out fee, no weekend surcharge, and parts at cost.',
    ],
    sections: [
      {
        h: 'Areas covered',
        p: [
          'All of Brisbane, Logan and Ipswich, plus the surrounding suburbs - from the CBD and inner north through to the Redland Coast, the Sunshine Coast and the northern Gold Coast. If you are within reach, I will come out; if you are not, call and ask.',
        ],
      },
      {
        h: 'What gets fixed',
        p: [
          'Slow computers, machines that will not boot, viruses and malware, pop-ups and browser hijackers, crashed or noisy fans, failing disks, dead laptops and cracked screens, broken printers and networks, new computers that need setting up, and the long tail of things that are annoying but not yet broken.',
        ],
      },
      {
        h: 'How to book',
        p: [
          'Call (07) 3155 2051 and describe the problem. I will tell you straight away whether it sounds like something I can fix, and what it will cost.',
          'Early mornings, evenings, weekends and public holidays are all normal. There is no surcharge for any of them.',
        ],
      },
    ],
    faqs: [
      {
        q: 'What areas do you cover?',
        a: 'All of Brisbane, Logan and Ipswich, plus the surrounding suburbs out to the Redland Coast, the Sunshine Coast and the northern Gold Coast. Call and ask if you are not sure - if I cannot reach you I will tell you rather than take the booking.',
      },
      {
        q: 'How much do computer repairs cost?',
        a: 'The flat onsite rate is $150 for the first hour, then 15-minute blocks. No call-out fee, no weekend or public holiday surcharge, and parts at cost. Most problems are fixed inside the first hour.',
      },
      {
        q: 'Do you guarantee the repair?',
        a: 'If I cannot fix it, you do not pay. If something I did stops working, call me back and I will return to look at it.',
      },
    ],
    related: ['computer-repairs', 'pc-optimization-faster-overall-speed', 'pc-health-check', 'remote-support'],
  },
];

/** Fast lookup by slug, for related-service links and CMS content. */
export const serviceBySlug = new Map<string, Service>(services.map((s) => [s.slug, s]));

/** The four families, keyed by hub slug. */
export const familyBySlug = new Map<string, ServiceFamily>(families.map((f) => [f.slug, f]));

/** Every page that is a service of some kind, for nav and the sitemap split. */
export const allServiceSlugs = [
  ...services.map((s) => s.slug),
  ...families.map((f) => f.slug),
];

/**
 * How the services group themselves in the Services dropdown.
 *
 * Grouped by what the customer is trying to get rid of rather than by internal
 * taxonomy - people recognise "my machine is full of junk" faster than
 * "uninstalling unwanted software". Each group resolves through `serviceBySlug`,
 * so a slug that is renamed in `services` drops out of the nav instead of
 * rendering a dead link.
 *
 * `pc-repairs-brisbane` is absent on purpose: it is a suburb-matrix page rather
 * than a service, and has its own link in the footer.
 */
export const serviceGroups: { heading: string; slugs: string[] }[] = [
  {
    heading: 'Junk & malware',
    slugs: [
      'virus-malware-and-spyware-removal-brisbane',
      'removal-spyware-infections',
      'removal-nagging-pop-windows',
      'browser-clean-and-hijack-repair',
      'removal-web-site-redirection',
      'junk-program-removal',
      'file-clean-registry-repair',
    ],
  },
  {
    heading: 'Slow or broken',
    slugs: [
      'pc-optimization-faster-overall-speed',
      'fix-slow-start',
      'pc-health-check',
      'computer-maintenance',
      'windows-reinstallation',
      'data-recovery',
    ],
  },
  {
    heading: 'Setup & support',
    slugs: [
      'computer-setup',
      'computer-upgrade',
      'network-setup',
      'remote-support',
      'apple-mac-repairs-brisbane',
    ],
  },
];
