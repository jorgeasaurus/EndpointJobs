export type WorkdaySite = {
  name: string;
  url: string;
  queries: readonly string[];
};

export const defaultWorkdaySites = [
  {
    name: "Accenture",
    url: "https://accenture.wd103.myworkdayjobs.com/wday/cxs/accenture/AccentureCareers/jobs",
    queries: [
      "Intune Engineer",
      "Endpoint Engineer",
      "Client Engineering",
      "End User Computer",
      "Workplace Engineer"
    ]
  },
  {
    name: "Goodwin",
    url: "https://goodwinprocter.wd5.myworkdayjobs.com/wday/cxs/goodwinprocter/External_Careers/jobs",
    queries: ["Manager Desktop Engineering", "Desktop Engineering", "Endpoint Engineer"]
  },
  {
    name: "GDIT",
    url: "https://gdit.wd5.myworkdayjobs.com/wday/cxs/gdit/External_Career_Site/jobs",
    queries: ["Endpoint Engineer", "Endpoint", "Intune", "Desktop Engineer"]
  },
  {
    name: "UT Austin",
    url: "https://utaustin.wd1.myworkdayjobs.com/wday/cxs/utaustin/UTstaff/jobs",
    queries: ["Senior Endpoint Engineer", "Endpoint Engineer", "Intune"]
  },
  {
    name: "Blue Origin",
    url: "https://blueorigin.wd5.myworkdayjobs.com/wday/cxs/blueorigin/BlueOrigin/jobs",
    queries: ["Endpoint Experience Administrator", "Endpoint Experience", "Intune"]
  },
  {
    name: "Dexcom",
    url: "https://dexcom.wd1.myworkdayjobs.com/wday/cxs/dexcom/Dexcom/jobs",
    queries: ["Sr Staff Desktop Systems Engineer", "Desktop Systems Engineer", "Endpoint Engineer"]
  },
  {
    name: "Leidos",
    url: "https://leidos.wd5.myworkdayjobs.com/wday/cxs/leidos/External/jobs",
    queries: ["End-Point Protection Engineer", "Endpoint Protection Engineer", "Endpoint Engineer", "Unified Endpoint Management"]
  },
  {
    name: "Booz Allen",
    url: "https://bah.wd1.myworkdayjobs.com/wday/cxs/bah/BAH_Jobs/jobs",
    queries: ["Endpoint", "Desktop", "Client Engineering", "End User Computing", "Intune", "Jamf", "Mac", "SCCM"]
  },
  {
    name: "HP",
    url: "https://hp.wd5.myworkdayjobs.com/wday/cxs/hp/ExternalCareerSite/jobs",
    queries: ["Endpoint Agent", "Endpoint Privilege Management", "Endpoint", "Desktop", "Intune", "SCCM"]
  },
  {
    name: "NVIDIA",
    url: "https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs",
    queries: ["Client Platform", "Client Platform Architect", "Endpoint", "Desktop", "End User Computing", "Jamf", "Mac"]
  },
  {
    name: "Adobe",
    url: "https://adobe.wd5.myworkdayjobs.com/wday/cxs/adobe/external_experienced/jobs",
    queries: ["Digital Employee Experience", "Endpoint", "Desktop", "End User Computing", "Intune", "Client Engineering"]
  },
  {
    name: "F5",
    url: "https://ffive.wd5.myworkdayjobs.com/wday/cxs/ffive/f5jobs/jobs",
    queries: ["Senior MDM Engineer", "Systems and Platform Administrator"]
  },
  {
    name: "Allstate",
    url: "https://allstate.wd5.myworkdayjobs.com/wday/cxs/allstate/Allstate_Careers/jobs",
    queries: ["Exposure Intelligence Analyst Endpoint Identity"]
  },
  {
    name: "Gartner",
    url: "https://gartner.wd5.myworkdayjobs.com/wday/cxs/gartner/EXT/jobs",
    queries: ["Windows Endpoint"]
  },
  {
    name: "Nordic Consulting",
    url: "https://nordic.wd1.myworkdayjobs.com/wday/cxs/nordic/Nordic/jobs",
    queries: ["MDM Engineer III"]
  },
  {
    name: "SHI",
    url: "https://shi.wd12.myworkdayjobs.com/wday/cxs/shi/shicareers/jobs",
    queries: ["endpoint Security"]
  },
  {
    name: "Circle",
    url: "https://circle.wd1.myworkdayjobs.com/wday/cxs/circle/Circle/jobs",
    queries: ["Senior Manager Endpoint Trusted Environments"]
  },
  {
    name: "Jabil",
    url: "https://jabil.wd5.myworkdayjobs.com/wday/cxs/jabil/Jabil_Careers/jobs",
    queries: ["Endpoint", "Endpoints", "Endpoint Security", "Intune", "SCCM", "Desktop"]
  },
  {
    name: "Vanguard",
    url: "https://vanguard.wd5.myworkdayjobs.com/wday/cxs/vanguard/vanguard_external/jobs",
    queries: ["Windows Endpoint", "Intune", "Jamf", "SCCM", "Desktop Engineer", "End User Computing"]
  },
  {
    name: "CACI",
    url: "https://caci.wd1.myworkdayjobs.com/wday/cxs/caci/External/jobs",
    queries: ["Endpoint Systems", "Endpoint Engineer", "Intune", "MECM", "SCCM", "Windows Endpoint", "macOS"]
  },
  {
    name: "KBR",
    url: "https://kbr.wd5.myworkdayjobs.com/wday/cxs/kbr/KBR_Careers/jobs",
    queries: ["End User Compute Engineer", "End User Compute", "Windows Endpoint", "SCCM", "Desktop Engineer", "End User Computing"]
  },
  {
    name: "The Hartford",
    url: "https://thehartford.wd5.myworkdayjobs.com/wday/cxs/thehartford/Careers_External/jobs",
    queries: ["End User Engineering", "Intune", "Windows Endpoint", "EUC", "SCCM"]
  },
  {
    name: "RBC",
    url: "https://rbc.wd3.myworkdayjobs.com/wday/cxs/rbc/RBCGLOBAL1/jobs",
    queries: ["Endpoint Security", "Mobile Device Management", "Intune", "Jamf", "SCCM", "Windows Endpoint"]
  },
  {
    name: "Autodesk",
    url: "https://autodesk.wd1.myworkdayjobs.com/wday/cxs/autodesk/Ext/jobs",
    queries: ["Digital Workplace Services Specialist", "Digital Workplace", "Jamf", "End User Computing"]
  },
  {
    name: "Capital One",
    url: "https://capitalone.wd12.myworkdayjobs.com/wday/cxs/capitalone/Capital_One/jobs",
    queries: ["Endpoint Security", "Endpoint", "Intune", "Jamf", "Desktop", "Digital Workplace"]
  },
  {
    name: "Thermo Fisher",
    url: "https://thermofisher.wd5.myworkdayjobs.com/wday/cxs/thermofisher/ThermoFisherCareers/jobs",
    queries: ["Endpoint Services", "Endpoint", "Desktop", "Intune", "SCCM", "End User Computing"]
  },
  {
    name: "Chatham Financial",
    url: "https://chathamfinancial.wd501.myworkdayjobs.com/wday/cxs/chathamfinancial/ChathamFinancial/jobs",
    queries: ["Digital Workplace Service Engineer", "Digital Workplace Engineer", "Endpoint", "Intune"]
  },
  {
    name: "Austal USA",
    url: "https://austalusa.wd1.myworkdayjobs.com/wday/cxs/austalusa/austal/jobs",
    queries: ["Desktop Engineer", "Endpoint", "Intune", "SCCM"]
  },
  {
    name: "MBDA Italy",
    url: "https://mbda.wd3.myworkdayjobs.com/wday/cxs/mbda/MBDA-Italy/jobs",
    queries: ["Digital Workplace", "User Support Specialist", "Endpoint", "Intune"]
  },
  {
    name: "Velera",
    url: "https://velera.wd5.myworkdayjobs.com/wday/cxs/velera/VeleraCareers/jobs",
    queries: ["Windows Platform", "Endpoint", "Intune", "Desktop Engineer"]
  },
  {
    name: "Pacific Life",
    url: "https://pacificlife.wd1.myworkdayjobs.com/wday/cxs/pacificlife/PacificLifeCareers/jobs",
    queries: ["Windows Infrastructure", "Endpoint", "Intune", "Desktop"]
  },
  {
    name: "General Motors",
    url: "https://generalmotors.wd5.myworkdayjobs.com/wday/cxs/generalmotors/Careers_GM/jobs",
    queries: ["Global Design IT", "Endpoint Engineer", "Client Platform", "Digital Workplace", "Intune"]
  },
  {
    name: "GEICO",
    url: "https://geico.wd1.myworkdayjobs.com/wday/cxs/geico/External/jobs",
    queries: ["Endpoint", "Intune"]
  }
] as const satisfies readonly WorkdaySite[];
