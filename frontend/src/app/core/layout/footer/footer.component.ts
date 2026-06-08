import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {
  // Founder social links
  founderLinkedin = 'https://www.linkedin.com/in/raj-kumar-10478386/';
  founderGithub = 'https://github.com/Raajkverma003';
  founderFacebook = 'https://www.facebook.com';
  founderTwitter = 'https://twitter.com';
  founderInstagram = 'https://www.instagram.com';

  founderPhone = '+91 9999855268';
  founderEmail = 'raajkverma003@gmail.com';
}

