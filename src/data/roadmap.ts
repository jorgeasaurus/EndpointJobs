export const roadmapLevelIds = ["foundations", "admin", "engineer", "architect"] as const;

export type RoadmapLevelId = (typeof roadmapLevelIds)[number];

export const roadmapLevelTitles: Record<RoadmapLevelId, string> = {
  foundations: "Foundations",
  admin: "Admin",
  engineer: "Engineer",
  architect: "Architect"
};

export type RoadmapSource = {
  title: string;
  url: string;
  publisher: string;
};

export type RoadmapSkill = {
  id: string;
  title: string;
  summary: string;
  sources: readonly RoadmapSource[];
};

export type RoadmapLevel = {
  id: RoadmapLevelId;
  title: string;
  summary: string;
  skills: readonly RoadmapSkill[];
};

export type RoadmapTrack = {
  id: string;
  title: string;
  summary: string;
  training?: readonly RoadmapSource[];
  levels: readonly RoadmapLevel[];
};

export const roadmapPageTitle = "Learning roadmap";

export const roadmapPageDescription =
  "A learning roadmap for endpoint engineers, with Microsoft Intune and Jamf tracks from foundations through architect.";

const learn = "Microsoft Learn";
const apple = "Apple Platform Deployment";
const jamfDocs = "Jamf Pro documentation";
const jamfTraining = "Jamf Training";
const jamfConnect = "Jamf Connect documentation";
const jamfProtect = "Jamf Protect documentation";
const jamfDev = "Jamf Developer";

export const roadmapTracks: readonly RoadmapTrack[] = [
  {
    id: "intune",
    title: "Microsoft Intune",
    summary:
      "Cloud endpoint management for Windows-first fleets: enroll the device, prove it is compliant, then ship apps and settings without imaging.",
    levels: [
      {
        id: "foundations",
        title: roadmapLevelTitles.foundations,
        summary: "Know what Intune manages, which identity the device has, and how a Windows PC gets enrolled.",
        skills: [
          {
            id: "intune.foundations.mdm-mam",
            title: "Separate MDM from MAM",
            summary:
              "Explain what Intune enrolls when it manages the whole device, and what it can still protect when it manages only the work apps.",
            sources: [
              {
                title: "What is Microsoft Intune?",
                url: "https://learn.microsoft.com/en-us/intune/fundamentals/what-is-intune",
                publisher: learn
              },
              {
                title: "Microsoft Intune core concepts",
                url: "https://learn.microsoft.com/en-us/intune/fundamentals/core-concepts",
                publisher: learn
              }
            ]
          },
          {
            id: "intune.foundations.entra-devices",
            title: "Place the device in Microsoft Entra ID",
            summary:
              "Tell Microsoft Entra registered, joined, and hybrid joined apart, and pick the join type for a cloud-native company PC.",
            sources: [
              {
                title: "What is a device identity?",
                url: "https://learn.microsoft.com/en-us/entra/identity/devices/overview",
                publisher: learn
              },
              {
                title: "Microsoft Entra joined devices",
                url: "https://learn.microsoft.com/en-us/entra/identity/devices/concept-directory-join",
                publisher: learn
              }
            ]
          },
          {
            id: "intune.foundations.admin-center",
            title: "Find your way around the Intune admin center",
            summary:
              "Open devices, apps, endpoint security, and tenant administration, and match each blade to the job it does.",
            sources: [
              {
                title: "Walkthrough the Microsoft Intune admin center",
                url: "https://learn.microsoft.com/en-us/intune/fundamentals/tutorial-admin-center-walkthrough",
                publisher: learn
              },
              {
                title: "Get started with Microsoft Intune",
                url: "https://learn.microsoft.com/en-us/intune/fundamentals/get-started",
                publisher: learn
              }
            ]
          },
          {
            id: "intune.foundations.windows-enrollment",
            title: "Enroll a Windows PC",
            summary:
              "Enroll with a user-driven path and with Windows Autopilot, and name what has to exist in the tenant before either one works.",
            sources: [
              {
                title: "Windows device enrollment guide",
                url: "https://learn.microsoft.com/en-us/intune/device-enrollment/windows/guide",
                publisher: learn
              },
              {
                title: "Overview of Windows Autopilot",
                url: "https://learn.microsoft.com/en-us/autopilot/overview",
                publisher: learn
              }
            ]
          }
        ]
      },
      {
        id: "admin",
        title: roadmapLevelTitles.admin,
        summary: "Run the daily admin center work: compliance, apps, updates, and the access rule that uses them.",
        skills: [
          {
            id: "intune.admin.compliance",
            title: "Write a compliance policy",
            summary:
              "Create a Windows compliance policy, set the checks that mark a device noncompliant, and choose the grace period before that mark applies.",
            sources: [
              {
                title: "Create device compliance policies",
                url: "https://learn.microsoft.com/en-us/intune/device-security/compliance/create-policy",
                publisher: learn
              },
              {
                title: "Endpoint security in Microsoft Intune",
                url: "https://learn.microsoft.com/en-us/intune/device-security/endpoint-security-policies",
                publisher: learn
              }
            ]
          },
          {
            id: "intune.admin.apps",
            title: "Assign apps as required or available",
            summary:
              "Add a store app and a Win32 app, assign each to a group, and choose Required when the device must have it and Available when the person opts in.",
            sources: [
              {
                title: "Add apps to Microsoft Intune",
                url: "https://learn.microsoft.com/en-us/intune/app-management/deployment/",
                publisher: learn
              },
              {
                title: "Win32 app management",
                url: "https://learn.microsoft.com/en-us/intune/app-management/deployment/win32",
                publisher: learn
              }
            ]
          },
          {
            id: "intune.admin.update-rings",
            title: "Stage Windows updates with rings",
            summary:
              "Create update rings that defer quality and feature updates, and assign a pilot ring before the production ring.",
            sources: [
              {
                title: "Manage Windows update rings",
                url: "https://learn.microsoft.com/en-us/intune/device-updates/windows/manage-update-rings",
                publisher: learn
              },
              {
                title: "Windows update management overview",
                url: "https://learn.microsoft.com/en-us/intune/device-updates/windows/",
                publisher: learn
              }
            ]
          },
          {
            id: "intune.admin.conditional-access",
            title: "Require a compliant device",
            summary:
              "Block a cloud app until Intune reports the device compliant, exclude a break-glass account, and stay in report-only until the impact is checked.",
            sources: [
              {
                title: "Require device compliance with Conditional Access",
                url: "https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-device-compliance",
                publisher: learn
              },
              {
                title: "What is Conditional Access?",
                url: "https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview",
                publisher: learn
              },
              {
                title: "Set up device-based Conditional Access with Intune",
                url: "https://learn.microsoft.com/en-us/intune/device-security/conditional-access-integration/device-based-policies",
                publisher: learn
              }
            ]
          }
        ]
      },
      {
        id: "engineer",
        title: roadmapLevelTitles.engineer,
        summary: "Package software, configure settings precisely, repair drift, and hold Autopilot until the device is ready.",
        skills: [
          {
            id: "intune.engineer.win32",
            title: "Package a Win32 app",
            summary:
              "Build an .intunewin file, add a detection rule that leaves a healthy install alone, and supersede the previous version.",
            sources: [
              {
                title: "Add and assign Win32 apps",
                url: "https://learn.microsoft.com/en-us/intune/app-management/deployment/add-win32",
                publisher: learn
              },
              {
                title: "Win32 app management",
                url: "https://learn.microsoft.com/en-us/intune/app-management/deployment/win32",
                publisher: learn
              },
              {
                title: "Microsoft Win32 Content Prep Tool",
                url: "https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool",
                publisher: "GitHub"
              }
            ]
          },
          {
            id: "intune.engineer.settings-catalog",
            title: "Configure Windows from the settings catalog",
            summary:
              "Build a configuration profile from the settings catalog, and use a custom OMA-URI only when the catalog does not list the setting.",
            sources: [
              {
                title: "Device features and settings in Microsoft Intune",
                url: "https://learn.microsoft.com/en-us/intune/device-configuration/overview",
                publisher: learn
              },
              {
                title: "Create a device configuration profile",
                url: "https://learn.microsoft.com/en-us/intune/device-configuration/create-device-profile",
                publisher: learn
              }
            ]
          },
          {
            id: "intune.engineer.remediations",
            title: "Detect and fix drift with remediations",
            summary:
              "Write a detection script that exits 1 only when a fix is needed, and a remediation script that leaves the device in the detected-good state.",
            sources: [
              {
                title: "Use remediations to detect and fix support issues",
                url: "https://learn.microsoft.com/en-us/intune/device-management/tools/deploy-remediations",
                publisher: learn
              },
              {
                title: "MSEndpointMgr",
                url: "https://msendpointmgr.com/",
                publisher: "MSEndpointMgr"
              }
            ]
          },
          {
            id: "intune.engineer.autopilot",
            title: "Hold Autopilot until setup finishes",
            summary:
              "Register a device, assign a user-driven deployment profile, and keep the Enrollment Status Page up until required apps and policies finish.",
            sources: [
              {
                title: "Configure Windows Autopilot profiles",
                url: "https://learn.microsoft.com/en-us/autopilot/profiles",
                publisher: learn
              },
              {
                title: "Enrollment Status Page",
                url: "https://learn.microsoft.com/en-us/autopilot/enrollment-status",
                publisher: learn
              },
              {
                title: "User-driven Microsoft Entra join",
                url: "https://learn.microsoft.com/en-us/autopilot/tutorial/user-driven/azure-ad-join-workflow",
                publisher: learn
              }
            ]
          }
        ]
      },
      {
        id: "architect",
        title: roadmapLevelTitles.architect,
        summary: "Choose the management plane, the security bar, who can change it, and how a change reaches production.",
        skills: [
          {
            id: "intune.architect.co-management",
            title: "Choose co-management or cloud-native",
            summary:
              "Name which Windows workloads stay with Configuration Manager, which move to Intune, and what a cloud-native fleet stops using on-premises.",
            sources: [
              {
                title: "Co-management for Windows devices",
                url: "https://learn.microsoft.com/en-us/intune/configmgr/comanage/overview",
                publisher: learn
              },
              {
                title: "Set up cloud-native Windows endpoints",
                url: "https://learn.microsoft.com/en-us/intune/solutions/cloud-native-endpoints/tutorial-cloud-native-setup",
                publisher: learn
              }
            ]
          },
          {
            id: "intune.architect.security-baseline",
            title: "Set the security baseline and Defender signal",
            summary:
              "Deploy an Intune security baseline, then onboard Microsoft Defender for Endpoint so device risk is available to access decisions.",
            sources: [
              {
                title: "Configure security baselines",
                url: "https://learn.microsoft.com/en-us/intune/device-security/security-baselines/configure-baselines",
                publisher: learn
              },
              {
                title: "Microsoft Defender for Endpoint with Intune",
                url: "https://learn.microsoft.com/en-us/intune/device-security/microsoft-defender/overview",
                publisher: learn
              }
            ]
          },
          {
            id: "intune.architect.rbac",
            title: "Limit admins with roles and scope tags",
            summary:
              "Assign a built-in role for the task, then add a scope tag so a regional admin sees and changes only that region's devices and policies.",
            sources: [
              {
                title: "Role-based access control with Microsoft Intune",
                url: "https://learn.microsoft.com/en-us/intune/fundamentals/role-based-access-control/overview",
                publisher: learn
              },
              {
                title: "Use scope tags for distributed IT",
                url: "https://learn.microsoft.com/en-us/intune/fundamentals/role-based-access-control/scope-tags",
                publisher: learn
              }
            ]
          },
          {
            id: "intune.architect.operating-model",
            title: "Pilot a change, then automate it",
            summary:
              "Pick a group, an assignment filter, or an update ring for the rollout, prove it on a pilot, and repeat the same change through Microsoft Graph when the click-path is the work.",
            sources: [
              {
                title: "Choose the right targeting method",
                url: "https://learn.microsoft.com/en-us/intune/fundamentals/choose-targeting-method",
                publisher: learn
              },
              {
                title: "Create assignment filters",
                url: "https://learn.microsoft.com/en-us/intune/fundamentals/filters/overview",
                publisher: learn
              },
              {
                title: "Working with Intune in Microsoft Graph",
                url: "https://learn.microsoft.com/en-us/graph/api/resources/intune-graph-overview?view=graph-rest-1.0",
                publisher: learn
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "jamf",
    title: "Jamf",
    summary:
      "Apple endpoint management in Jamf Pro. The vendor courses follow the same foundations-to-architect path.",
    training: [
      {
        title: "Jamf 100 Course",
        url: "https://www.jamf.com/training/100-course/",
        publisher: jamfTraining
      },
      {
        title: "Jamf 200 Course",
        url: "https://www.jamf.com/training/200-course/",
        publisher: jamfTraining
      },
      {
        title: "Jamf 300 Course",
        url: "https://www.jamf.com/training/300-course/",
        publisher: jamfTraining
      },
      {
        title: "Jamf 400 Course",
        url: "https://www.jamf.com/training/400-course/",
        publisher: jamfTraining
      }
    ],
    levels: [
      {
        id: "foundations",
        title: roadmapLevelTitles.foundations,
        summary: "Know how Apple expects organization-owned devices to enroll, and how Jamf Pro records them.",
        skills: [
          {
            id: "jamf.foundations.apple-mdm",
            title: "Explain Apple device management",
            summary:
              "Describe supervision, MDM, Apple Business, and Automated Device Enrollment, and why an organization-owned Mac should enroll that way.",
            sources: [
              {
                title: "Deploy devices with Apple Business",
                url: "https://support.apple.com/guide/deployment/deploy-devices-apple-school-manager-business-depd3a5dd518/web",
                publisher: apple
              },
              {
                title: "Automated Device Enrollment and device management",
                url: "https://support.apple.com/guide/deployment/automated-device-enrollment-management-dep73069dd57/web",
                publisher: apple
              },
              {
                title: "Jamf 100 Course",
                url: "https://www.jamf.com/training/100-course/",
                publisher: jamfTraining
              }
            ]
          },
          {
            id: "jamf.foundations.inventory",
            title: "Read a computer inventory record",
            summary:
              "Open a Mac's inventory and separate the facts Jamf Pro collected on check-in from the facts you still have to add yourself.",
            sources: [
              {
                title: "Inventory for computers",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Inventory_for_Computers",
                publisher: jamfDocs
              },
              {
                title: "Jamf 100: searches, inventory, and remote commands",
                url: "https://learn.jamf.com/r/en-US/jamf-100-course-current/Lesson_12",
                publisher: jamfTraining
              }
            ]
          },
          {
            id: "jamf.foundations.groups",
            title: "Choose a static group or a smart group",
            summary:
              "Put a lab in a static group, build a smart group from inventory criteria, and use the smart group when membership should change on its own.",
            sources: [
              {
                title: "Smart groups",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Smart_Groups",
                publisher: jamfDocs
              },
              {
                title: "Jamf 100: device groups",
                url: "https://learn.jamf.com/r/en-US/jamf-100-course-current/Lesson_14",
                publisher: jamfTraining
              }
            ]
          },
          {
            id: "jamf.foundations.enrollment",
            title: "Enroll a Mac with a PreStage",
            summary:
              "Connect Jamf Pro to Automated Device Enrollment, assign the Mac to a computer PreStage, and confirm it enrolls during Setup Assistant.",
            sources: [
              {
                title: "Automated Device Enrollment integration",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Automated_Device_Enrollment_Integration",
                publisher: jamfDocs
              },
              {
                title: "Computer PreStage enrollments",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Computer_PreStage_Enrollments",
                publisher: jamfDocs
              },
              {
                title: "Create or edit a computer PreStage enrollment",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Configuring_a_Computer_PreStage_Enrollment",
                publisher: jamfDocs
              }
            ]
          }
        ]
      },
      {
        id: "admin",
        title: roadmapLevelTitles.admin,
        summary: "Ship the everyday Jamf Pro objects: policies, profiles, software, and patches.",
        skills: [
          {
            id: "jamf.admin.policies",
            title: "Run work with a policy",
            summary:
              "Create a policy with a trigger, an execution frequency, and a scope, and make it available in Self Service when a person should run it.",
            sources: [
              {
                title: "Policies",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Policies",
                publisher: jamfDocs
              },
              {
                title: "Creating a policy",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Creating_a_Policy",
                publisher: jamfDocs
              },
              {
                title: "Self Service for macOS",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Jamf_Self_Service_for_macOS",
                publisher: jamfDocs
              }
            ]
          },
          {
            id: "jamf.admin.profiles",
            title: "Deploy a configuration profile",
            summary:
              "Install a computer-level profile automatically, and predict when a user-level payload waits until that user logs in.",
            sources: [
              {
                title: "Computer configuration profiles",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Computer_Configuration_Profiles",
                publisher: jamfDocs
              },
              {
                title: "Jamf 200 Course",
                url: "https://www.jamf.com/training/200-course/",
                publisher: jamfTraining
              }
            ]
          },
          {
            id: "jamf.admin.software",
            title: "Distribute a package or an App Installers title",
            summary:
              "Upload a package for a policy to install, and turn on an App Installers title when Jamf already tracks that vendor's updates.",
            sources: [
              {
                title: "Packages",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Packages",
                publisher: jamfDocs
              },
              {
                title: "App Installers",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/App_Installers",
                publisher: jamfDocs
              },
              {
                title: "Distributing software titles with App Installers",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Distributing_Software_Titles_with_App_Installers",
                publisher: jamfDocs
              }
            ]
          },
          {
            id: "jamf.admin.patch",
            title: "Patch a title Jamf already recognizes",
            summary:
              "Enable a patch software title and scope a patch policy to the Macs whose inventory shows they are behind.",
            sources: [
              {
                title: "Patch management",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/PatchManagement",
                publisher: jamfDocs
              },
              {
                title: "Patch policies",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Patch_Policies",
                publisher: jamfDocs
              }
            ]
          }
        ]
      },
      {
        id: "engineer",
        title: roadmapLevelTitles.engineer,
        summary: "Extend inventory, script the gaps, call the API, and pick the right install tool.",
        skills: [
          {
            id: "jamf.engineer.extension-attributes",
            title: "Collect a fact with an extension attribute",
            summary:
              "Add a script extension attribute for something inventory does not store, and use the result as smart group criteria.",
            sources: [
              {
                title: "Computer extension attributes",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Computer_Extension_Attributes",
                publisher: jamfDocs
              },
              {
                title: "Extension attribute input types",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Extension_Attribute_Input_Types_macOS",
                publisher: jamfDocs
              }
            ]
          },
          {
            id: "jamf.engineer.scripts",
            title: "Run a script from a policy and read the log",
            summary:
              "Deploy a zsh script in a policy, then use the policy log's exit code and output to see why a Mac failed.",
            sources: [
              {
                title: "Scripts",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Scripts",
                publisher: jamfDocs
              },
              {
                title: "Scripting OS X",
                url: "https://scriptingosx.com/",
                publisher: "Scripting OS X"
              },
              {
                title: "Der Flounder",
                url: "https://derflounder.wordpress.com/",
                publisher: "Der Flounder"
              }
            ]
          },
          {
            id: "jamf.engineer.api",
            title: "Change Jamf Pro with the API",
            summary:
              "Request a bearer token and call the Jamf Pro API to read or update an object the account is allowed to change.",
            sources: [
              {
                title: "Jamf Pro API overview",
                url: "https://developer.jamf.com/jamf-pro/docs/jamf-pro-api-overview",
                publisher: jamfDev
              },
              {
                title: "Jamf Pro API reference",
                url: "https://developer.jamf.com/jamf-pro/reference/jamf-pro-api",
                publisher: jamfDev
              },
              {
                title: "Jamf 300 Course",
                url: "https://www.jamf.com/training/300-course/",
                publisher: jamfTraining
              }
            ]
          },
          {
            id: "jamf.engineer.packaging",
            title: "Pick a package policy or Installomator",
            summary:
              "Install a vendor app with a package policy, or with Installomator when you want Jamf to keep fetching the current pkg, and don't put that install in a configuration profile.",
            sources: [
              {
                title: "Packages",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Packages",
                publisher: jamfDocs
              },
              {
                title: "Using Installomator with Jamf Pro",
                url: "https://scriptingosx.com/2020/06/using-installomator-with-jamf-pro/",
                publisher: "Scripting OS X"
              },
              {
                title: "Jamf 300 Course",
                url: "https://www.jamf.com/training/300-course/",
                publisher: jamfTraining
              }
            ]
          }
        ]
      },
      {
        id: "architect",
        title: roadmapLevelTitles.architect,
        summary: "Design zero-touch enrollment, identity, the security bar, and how a large Jamf Pro tenant is split.",
        skills: [
          {
            id: "jamf.architect.zero-touch",
            title: "Design the PreStage before the desktop appears",
            summary:
              "Decide the local account, the Setup Assistant skips, and the remote-management payload so the Mac is managed before anyone reaches the desktop.",
            sources: [
              {
                title: "Computer PreStage enrollments",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Computer_PreStage_Enrollments",
                publisher: jamfDocs
              },
              {
                title: "Automated Device Enrollment integration",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Automated_Device_Enrollment_Integration",
                publisher: jamfDocs
              },
              {
                title: "Automated Device Enrollment and device management",
                url: "https://support.apple.com/guide/deployment/automated-device-enrollment-management-dep73069dd57/web",
                publisher: apple
              }
            ]
          },
          {
            id: "jamf.architect.identity",
            title: "Use Jamf Connect for first login, then remove it",
            summary:
              "Deploy Jamf Connect so the first login creates the account from your identity provider, and scope enrollment-only settings so they leave after setup.",
            sources: [
              {
                title: "Jamf Connect documentation",
                url: "https://learn.jamf.com/r/en-US/jamf-connect-documentation-current/Jamf_Connect_Documentation",
                publisher: jamfConnect
              },
              {
                title: "Enrollment-only Jamf Connect settings",
                url: "https://learn.jamf.com/r/en-US/jamf-connect-documentation-current/Configuring_Enrollment-only_Jamf_Connect_Settings",
                publisher: jamfConnect
              }
            ]
          },
          {
            id: "jamf.architect.security",
            title: "Require FileVault and place Jamf Protect",
            summary:
              "Turn FileVault on and escrow the recovery key during or just after enrollment, then target Jamf Protect plans at the Macs that need them.",
            sources: [
              {
                title: "Manage FileVault with device management",
                url: "https://support.apple.com/guide/deployment/manage-filevault-with-device-management-dep0a2cb7686/web",
                publisher: apple
              },
              {
                title: "Jamf Protect documentation",
                url: "https://learn.jamf.com/r/en-US/jamf-protect-documentation/Jamf_Protect_Documentation",
                publisher: jamfProtect
              },
              {
                title: "Plans",
                url: "https://learn.jamf.com/r/en-US/jamf-protect-documentation/Plans",
                publisher: jamfProtect
              }
            ]
          },
          {
            id: "jamf.architect.scale",
            title: "Split the tenant, then declare the configuration",
            summary:
              "Put devices and policies in sites, limit each account to the privileges that site needs, and move ongoing configuration to declarative device management.",
            sources: [
              {
                title: "Sites",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Sites",
                publisher: jamfDocs
              },
              {
                title: "Jamf Pro user accounts and groups",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Jamf_Pro_User_Accounts_and_Groups",
                publisher: jamfDocs
              },
              {
                title: "Declarative device management",
                url: "https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Declarative_Device_Management",
                publisher: jamfDocs
              }
            ]
          }
        ]
      }
    ]
  }
];

export function skillIdsForLevel(level: RoadmapLevel): string[] {
  return level.skills.map((skill) => skill.id);
}

export function skillIdsForTrack(track: RoadmapTrack): string[] {
  return track.levels.flatMap((level) => skillIdsForLevel(level));
}

export function allRoadmapSkillIds(): string[] {
  return roadmapTracks.flatMap((track) => skillIdsForTrack(track));
}

export const roadmapSkillIdSet: ReadonlySet<string> = new Set(allRoadmapSkillIds());
