import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/distinctUntilChanged';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/finally';
import 'rxjs/add/observable/empty';

import { ApiAccess } from '../../interfaces/api-access';
import { AccessTokenService } from '../access-token.service';
import { AuthService } from '../auth.service';
import { ExceptionService } from '../../core/exception.service';
import { RegisterFormQuestionsService } from './register-form-questions.service';
import { QuestionBase } from '../../shared/question-base';
import { QuestionControlService } from '../../shared/question-control.service';
import { UserDataService } from '../../core/resources/user-data.service';
import { ConfirmedPasswordFormService } from '../confirmed-password-form/confirmed-password-form.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  providers: [RegisterFormQuestionsService]
})
export class RegisterComponent implements OnInit, OnDestroy {
  questions: any;

  busy: boolean;
  hasDuplicate: boolean;
  verified: boolean;

  email: string;
  name: string;

  emailForm: FormGroup;
  nameForm: FormGroup;
  passwordForm: FormGroup;

  emailSubscription: Subscription;

  constructor(
    private accessToken: AccessTokenService,
    private auth: AuthService,
    private confirmedPasswordForm: ConfirmedPasswordFormService,
    private exception: ExceptionService,
    private questionControl: QuestionControlService,
    private questionSource: RegisterFormQuestionsService,
    private router: Router,
    private userData: UserDataService,
  ) { }

  ngOnInit() {
    this.questions = this.questionSource.get();
    this.emailForm = this.questionControl.toFormGroup(this.questions.email);
    this.nameForm = this.questionControl.toFormGroup(this.questions.name);

    this.confirmedPasswordForm.buttonLabel = 'Register';

    this.emailSubscription = this.emailForm.get('email').valueChanges
      .do(email => this.verified = false)
      .debounceTime(400)  
      .distinctUntilChanged()
      .switchMap(email => {
        if(this.emailForm.valid)
        {
          return this.verify(email)
            .finally(() => this.busy = false)
            .catch(error => {
              this.exception.handle(error);
              return Observable.empty();
            });
        }

        return Observable.empty();
      })
      .subscribe((hasDuplicate: boolean) => {
        this.hasDuplicate = hasDuplicate;
        this.questions.email.find(form => form.key === 'email').showCustomError = hasDuplicate;
        this.verified = true;
      });

    this.confirmedPasswordForm.passwordForm$.subscribe(form => {
      this.passwordForm = form; 
      this.register();
    });
  }

  ngOnDestroy() {
    this.emailSubscription.unsubscribe();
  }

  /**
   * Set the nameForm stepper label to name.
   */
  setName() {
    this.name = this.nameForm.get('name').value;
  }

  /**
   * Set the emailForm stepper label to the email. 
   * 
   */
  setEmail() {
    this.email = this.emailForm.get('email').value;
  }

  /**
   * Register the user.
   * 
   */
  register() {
    if(this.emailForm.valid && !this.hasDuplicate)
    {
      const payload = {
        name: this.nameForm.get('name').value,
        email: this.emailForm.get('email').value,
        password: this.passwordForm.get('password').value,
        password_confirmation: this.passwordForm.get('password_confirmation').value
      }

      this.auth.register(payload)
        .catch(error => {
          this.confirmedPasswordForm.busy = false;
          this.exception.handle(error);
          return Observable.empty();
        })
        .switchMap(user => {
          return this.auth.login(payload.email, payload.password)
            .finally(() => this.confirmedPasswordForm.busy = false)
            .catch(error => {
              this.exception.handle(error);
              return Observable.empty();
            });
        })
        .subscribe((apiAccess: ApiAccess) => {
          if(apiAccess) {
            this.accessToken.store('apiAccess', apiAccess);
            this.router.navigate(['/']);
          };
        });
    }
  }

  /**
   * Verify if the email is available in the resource.
   * 
   * @param email 
   */
  verify(email: string): Observable<boolean> {
    if(this.emailForm.valid && !this.busy)
    {
      this.busy = true;
  
      return this.auth.validateEmail({ email });
    }

    return Observable.empty();
  }
}
