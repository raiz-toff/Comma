// The gig platforms Comma ships for in Canada, with the same inline SVG marks
// the apps use (web/src/registry/platforms/_logos.js). Rendered in the homepage
// marquee, each tinted with its real brand color via currentColor.

export interface PlatformMark {
  name: string;
  color: string;
  svg: string;
}

export const PLATFORM_MARKS: PlatformMark[] = [
  {
    name: 'DoorDash',
    color: '#FF3008',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.071 8.409a6.09 6.09 0 0 0-5.396-3.228H.584A.589.589 0 0 0 .17 6.184L3.894 9.93a1.752 1.752 0 0 0 1.242.516h12.049a1.554 1.554 0 1 1 .031 3.108H8.91a.589.589 0 0 0-.415 1.003l3.725 3.747a1.75 1.75 0 0 0 1.242.516h3.757c4.887 0 8.584-5.225 5.852-10.413"/></svg>`,
  },
  {
    name: 'Uber Eats',
    color: '#06C167',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 192 192" fill="none" aria-hidden="true"><defs><style>.ue2,.ue3{fill:none;stroke:currentColor;stroke-linecap:round;stroke-width:8px}.ue2{stroke-miterlimit:10}.ue3{stroke-linejoin:round}</style></defs><path d="M20 41.85v31.73c.77 8.11 8.14 14.41 16.88 14.52 8.91.12 16.58-6.25 17.36-14.52V41.85" class="ue3"/><path d="M54.24 88.11V55.2m13.84 32.91V41.85" class="ue2"/><circle cx="84.53" cy="71.66" r="16.45" class="ue2"/><path d="M142.57 82.97c-3 3.17-7.24 5.14-11.95 5.14-9.09 0-16.45-7.37-16.45-16.45s7.37-16.45 16.45-16.45 16.45 7.37 16.45 16.45h-32.9" class="ue3"/><path d="M160.22 88.11V56.96m11.78 0h0c-1.9 0-3.77.45-5.45 1.32-2.73 1.42-6.33 3.97-6.33 7.51" class="ue2"/><path d="M50.04 105.14H20v45.01h30.04" class="ue3"/><path d="M20 127.65h30.04m47.61 22.5v-33.08" class="ue2"/><circle cx="78.4" cy="133.61" r="16.54" class="ue2"/><path d="M118.62 105.14v40.5c0 2.49 2.02 4.51 4.51 4.51h7.38" class="ue3"/><path d="M109.49 118.52h21.02" class="ue2"/><path d="M144.59 142.08c0 4.33 6.14 7.83 13.71 7.83s13.71-3.51 13.71-7.83-6.14-7.83-13.71-7.83-13.71-3.51-13.71-7.83 6.14-7.83 13.71-7.83 13.71 3.51 13.71 7.83" class="ue3"/></svg>`,
  },
  {
    name: 'SkipTheDishes',
    color: '#ED5A1F',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" rx="4" fill="#ED5A1F"/><path fill="#fff" d="M6 6h8v2H9v2h4v2H9v4H6V6z"/></svg>`,
  },
  {
    name: 'Foodora',
    color: '#D61F5C',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true"><defs><style>.fd{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round}</style></defs><line class="fd" x1="4.5" y1="27.83" x2="43.5" y2="27.83"/><path class="fd" d="M41.3 27.83c0-9.5545-7.7455-17.3-17.3-17.3S6.7 18.2755 6.7 27.83"/><path class="fd" d="M16.7945 14.7322c-3.5091 2.2954-5.8569 6.2191-5.9702 10.6979"/><line class="fd" x1="24" y1="10.53" x2="24" y2="8.27"/><path class="fd" d="M24.94 34.55c5.1979-.0628 5.8635-.28 15.4748-2.7195.6056-.1537 1.0539.1565 1.1859.5082.1353.3606.0794.9987-.7407 1.2113-1.62.42-11.72 5.08-14.02 5.08s-9-.5-11.52-.5-5.46 1.6-5.46 1.6c-2.02-1.88-3.3-5-3.64-8.38h24.96c1.0309 0 1.36 1.44.48 1.84-1.3047.5931-3.52 1.36-6.72 1.36"/></svg>`,
  },
  {
    name: 'Instacart',
    color: '#43B02A',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M20.839 12.823c1.896 1.906 3.443 5.026 2.557 6.87-2.37 4.953-20.052 13.635-21.557 12.135-1.5-1.5 7.188-19.193 12.135-21.568 1.849-.88 4.964.682 6.87 2.563l-.005.021zM30.208 10.74c-.307-1.141-1.094-2.292-2.266-2.427-2.146-.25-5.536 3.547-5.297 4.448.245.922 5.026 2.5 6.802 1.224.922-.661 1.042-2.083.74-3.219zM23.552.208c1.599.432 3.214 1.531 3.406 3.177.344 3.016-4.979 7.76-6.245 7.422-1.26-.339-3.49-7.047-1.688-9.552.927-1.297 2.932-1.474 4.531-1.052v.005z"/></svg>`,
  },
  {
    name: 'Amazon Flex',
    color: '#FF9900',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" rx="4" fill="#232F3E"/><path fill="#FF9900" d="M5 14V6h2l2.5 5 2.5-5h2v8h-2V9.5L9 14H8L6 9.5V14H5z"/></svg>`,
  },
];
